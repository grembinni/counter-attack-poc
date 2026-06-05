# Roadmap — Counter Attack Web

## Phases

- [x] **Phase 1: Monorepo Scaffold + Shared Types** — pnpm workspace, TypeScript config, all shared interfaces, hex math utilities, Socket.io event constants (completed 2026-05-28)
- [x] **Phase 2: Move Validator + Unit Tests** — Pure validation functions for movement, passing, heading, shooting, snapshots, ZoI, and Loose Ball; fully tested with no server dependency (completed 2026-05-29)
- [x] **Phase 3: Server Room Manager + Socket.io Scaffold** — Express server, Socket.io room lifecycle, session identity, disconnect/cleanup timers, health endpoint (completed 2026-05-29)
- [x] **Phase 4: Game Engine + Phase FSM** — Explicit FSM wired to socket events, 4-5-2 movement sequence, hardcoded teams and pitch data, deterministic (stub) dice (completed 2026-05-30)
- [x] **Phase 5: Dice Resolver + All Resolution Branches** — Server-side crypto dice, pass accuracy, shot/save duels, heading duels, Loose Ball, GK restart choice (completed 2026-05-30)
- [x] **Phase 6: React Hex Grid Renderer** — SVG pitch from mock state, piece overlays, valid-move highlighting, lobby UI, turn indicator, action log, scoreboard (completed 2026-05-31)
- [x] **Phase 7: Client-Server Integration** — Zustand + Socket.io wired to live server, click handlers, undo, connection status, first playable local session (completed 2026-06-03)
- [x] **Phase 7.1: UI Cleanup** — Address UX rough edges found during Phase 7 UAT: lobby flow, join UX, connection status, team positioning, and visual polish (INSERTED) (completed 2026-06-04)
- [x] **Phase 8: Match Lifecycle + Post-Game Replay** — Action counters, added time, half transitions, full-time detection, kick off procedure, post-game replay (completed 2026-06-05)
- [ ] **Phase 8.1: Cleanup — Player Stats, Ball Control, Movement, Tackling** — Fix 1–6 stat scale, rebalance squads by tier, fix steal to dribbling-vs-tackling duel, fix movement UX (sticky selection + ZoI coloring) (INSERTED)
- [ ] **Phase 8.2: Passing Cleanup** — Target hex selection, correct accuracy attribute per pass type, ball movement on accurate pass, interception by adjacent defenders (INSERTED)
- [ ] **Phase 8.3: Remaining Action Flows + Tech Debt** — Shot declaration flow, all broken post-movement actions, code review debt from Phase 8 (CR-01 timer leak, WR-01..WR-04), human UAT verification items (INSERTED)
- [ ] **Phase 9: AWS Deployment** — Dockerised server to Elastic Beanstalk, React build to S3 + CloudFront, ALB timeout config, environment variables, smoke test

---

## Phase Details

### Phase 1: Monorepo Scaffold + Shared Types

**Goal:** The pnpm monorepo exists with working TypeScript compilation across all three packages and all shared types, hex math functions, and Socket.io event constants available for import.
**Depends on:** Nothing
**Requirements:** ARCH-02, ARCH-03, ARCH-07
**Success Criteria**:

1. `pnpm install` and `pnpm build` succeed from the repo root with zero errors across `packages/shared`, `packages/server`, and `packages/client`
2. `packages/shared` exports `HexCoord`, `GameState`, `PlayerPiece`, `BallState`, and `GamePhase` TypeScript types that `server` and `client` can import without path hacks
3. `hexDistance`, `hexNeighbors`, `hexesInRange`, and `isUnderZoI` functions are exported from `packages/shared/src/hex.ts` with no Socket.io or Express imports present
4. Socket.io event name constants are defined as typed `const` objects in `packages/shared` and importable in both `server` and `client`
5. A placeholder `PITCH_HEXES` coordinate set (rectangular grid) is present in `packages/shared/src/pitch.ts` with a comment marking it as pending real board measurements

**Plans:** 3/3 plans complete

**Wave 1**

- [x] 01-01-PLAN.md — Wave 0: pnpm bootstrap, root devDeps, tsconfig.base.json, ESLint flat config, Prettier, Husky + lint-staged
- [x] 01-02-PLAN.md — Wave 1: packages/shared (types, hex math, events, pitch, Vitest tests, build to dist)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 01-03-PLAN.md — Wave 2: packages/server + packages/client placeholders, full-repo pnpm -r build verification

### Phase 2: Move Validator + Unit Tests

**Goal:** All game rule validation logic — movement, passing, heading, shooting, snapshots, Zone of Influence, and Loose Ball — exists as pure functions in `packages/shared` with a passing unit test suite.
**Depends on:** Phase 1
**Requirements:** MOVE-01, MOVE-02, MOVE-03, MOVE-04, MOVE-05, MOVE-06, MOVE-07, PASS-01, PASS-02, PASS-03, PASS-04, PASS-05, HEAD-01, HEAD-02, HEAD-03, HEAD-04, HEAD-05, SNAP-01, SNAP-02, SNAP-03, SHOT-01, SHOT-02, SHOT-03, SHOT-04, SHOT-06, DICE-03, DICE-04, DICE-05
**Success Criteria**:

1. A test runner (`pnpm test` in `packages/shared`) executes 20+ unit tests covering legal and illegal movement paths, ZoI enforcement at grid edges, pass range limits for all four pass types, and heading duel eligibility — all tests pass
2. `validateMove()` rejects a piece moving to an occupied hex and rejects Pace-busting moves, and accepts moves within Pace that do not violate occupancy
3. `validatePass()` enforces the correct hex distance cap for Standard (11), First-time (6), High (15), and Long (any) pass types, and marks inaccurate passes as triggering Loose Ball
4. `computeZoI()` returns the correct adjacent-hex set for any piece position and `isUnderZoI()` correctly identifies when a ball-carrier enters a defender's influence
5. All validation functions have zero imports from `socket.io`, `express`, or any server package — confirmed by TypeScript compilation of `packages/shared` in isolation

**Plans:** 4/4 plans complete

**Wave 1**

- [x] 02-01-PLAN.md — Foundation: hex.ts extensions (hexLine, getZoIDefenders), GameState D-08 fields, scoreUtils (computeCombinedScore, computeLooseBall), barrel export

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 02-02-PLAN.md — Move validator: validateMove with 4-5-2 slot semantics, Pace caps, occupancy, ATTACKER_2 restriction, ZoI steal trigger
- [x] 02-03-PLAN.md — Pass validator: validatePass (all four types, path blocking, interception list) and validatePassAccuracy (HIGH/LONG thresholds, Loose Ball trigger)
- [x] 02-04-PLAN.md — Shot + Heading + Snapshot validators bundled (validateShotDuel/Dive/HandlingCheck, validateHeading, validateSnapshot)

### Phase 3: Server Room Manager + Socket.io Scaffold

**Goal:** Two browser tabs can connect to the Express server, create and join a room via a shared room code, be assigned player slots, and have the server track their session identity and handle disconnects gracefully.
**Depends on:** Phase 1
**Requirements:** CONN-01, CONN-02, CONN-03, CONN-04, ARCH-01, ARCH-04
**Success Criteria**:

1. A client emitting `room:create` receives a unique 4-6 character alphanumeric room code and is assigned as Player 1; a second client emitting `room:join` with that code is assigned as Player 2 and both receive a `room:joined` broadcast
2. The server rejects `room:join` for a nonexistent code with an error event, and rejects join for a room already in progress with a distinct error event
3. On disconnect, the server starts a 90-second grace timer and emits a disconnect-warning event to the remaining player; if the disconnected tab reconnects with its session token within 90s, it is reassigned to its original player slot without interrupting the room
4. The server emits a full `game:state` broadcast after every validated state change, containing the complete `GameState` object
5. `GET /health` returns HTTP 200, confirming the server is reachable for AWS ALB health checks

**Plans:** 3/3 plans complete

**Wave 1**

- [x] 03-01-PLAN.md — Wave 1: install server deps (express, socket.io, cors, nanoid, vitest 2.1.9, socket.io-client), vitest.config.ts, extend SocketData with sessionToken

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 03-02-PLAN.md — Wave 2: roomStore.ts (createRoom/joinRoom/findPlayerByToken/broadcastState + Room type with isProcessing) + sessionMiddleware.ts + roomStore unit tests

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 03-03-PLAN.md — Wave 3: createServer.ts (Express + Socket.io factory, /health, websocket-only) + roomHandlers.ts (ROOM_CREATE/ROOM_JOIN/disconnect with 90s grace) + main.ts + integration tests

### Phase 4: Game Engine + Phase FSM

**Goal:** The full Movement Phase FSM runs end-to-end on the server — both players can move pieces in the correct 4-5-2 sequence, teams and pitch regions are encoded, and the server broadcasts validated state after every action.
**Depends on:** Phase 2, Phase 3
**Requirements:** TEAM-01, TEAM-02, TEAM-03, PITCH-01, PITCH-02, PITCH-03
**Success Criteria**:

1. Two hardcoded squads (11 players each) with all nine attributes (Pace, Shooting, Tackling, Dribbling, Heading, Saving, Handling, Resilience, Aerial Ability) are present in `packages/shared` and loaded into game state at match start
2. The FSM enforces the 4-5-2 movement sequence: attacker moves exactly 4 players, then defender moves exactly 5, then attacker moves exactly 2 new players; attempting to move out of sequence is rejected with an error event
3. Pitch regions — final thirds, penalty areas, 6-yard boxes, centre circle, kickoff hex, and difficult-angle hexes — are encoded and referenced correctly by the server when evaluating actions in those zones
4. A referee card with a Leniency attribute is randomly assigned at match start and stored in game state
5. The per-room `isProcessing` mutex prevents duplicate action processing; a second identical action arriving while the first is processing is silently dropped

**Plans:** 3/3 plans complete

**Wave 1**

- [x] 04-01-PLAN.md — Shared types + data: ActionEvent union, RefereeCard, MovementSlot, PlayerPiece name/role, attackingTeam; teams.ts (HOME/AWAY squads); pitch.ts regions + difficult-angle hexes; game:end-turn/undo/error events + tests

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 04-02-PLAN.md — gameEngine.ts: buildInitialGameState, advanceMovementSlot, applyMove, applyEndTurn, applyUndo, MOVE-06 free-move; unit tests + integration harness skeleton

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 04-03-PLAN.md — gameHandlers.ts (game:move/end-turn/undo with isProcessing mutex + active-player guard); wire buildInitialGameState into joinRoom + registerGameHandlers into createServer; fill integration scenarios

**UI hint**: yes

### Phase 5: Dice Resolver + All Resolution Branches

**Goal:** All stochastic resolution paths — pass accuracy, shot/save duels, heading duels, Loose Ball, and GK restart — use server-side cryptographic dice and produce correct outcomes broadcast to both clients.
**Depends on:** Phase 4
**Requirements:** DICE-01, DICE-02, SHOT-05
**Success Criteria**:

1. All dice are generated exclusively by `crypto.randomInt` on the server; no dice values originate from the client; confirmed by the absence of any random number generation in `packages/client`
2. The active player emits a `game:roll` event triggered by explicit user action; the server responds with a `game:state` broadcast containing the dice result visible to both players before any outcome is applied
3. Pass accuracy checks (High Pass 8+, Long Pass 9+/10+), shot/save duels, heading duels, and handling checks all produce the correct combined-score outcome and transition to the correct next FSM phase
4. Loose Ball resolution rolls direction (1-6) and distance (1-6 hexes) from the incident hex and updates ball position in the broadcast state
5. After catching the ball, the goalkeeper's `game:state` reflects a `GK_RESTART` phase in which the GK player can choose kick (High Pass accuracy check), quick throw (Standard Pass distance, uninterceptable), or start a Movement Phase

**Plans:** 4/4 plans complete

### Phase 6: React Hex Grid Renderer

**Goal:** The React client renders a complete, interactive hex-grid pitch from a hardcoded mock GameState — with piece overlays, ball marker, valid-move highlighting, lobby screens, turn indicator, and action log — without any server connection.
**Depends on:** Phase 1
**Requirements:** PITCH-04, PITCH-05, UX-01, UX-02, UX-03, UX-04
**Success Criteria**:

1. The SVG pitch component renders all pitch hexes in the correct axial layout; player pieces and the ball are displayed as visually distinct overlays on their correct hexes; the board is readable on a desktop browser at 1280px width
2. Clicking a player piece immediately highlights its valid destination hexes; clicking an invalid (non-highlighted) hex produces no response; clicking a highlighted hex moves the piece in the mock state
3. The turn indicator shows the active team name, current FSM phase label, and actions-remaining count drawn from mock state
4. An action log panel shows the last 5 structured log entries from mock state (actor, action type, coordinates, dice result, outcome) in reverse-chronological order
5. Lobby screens exist for Create Room (displays generated code with copy-to-clipboard), Join Room (room code input), and Waiting for Opponent (shows code again); these are navigable in isolation without a server

**Plans:** 3/3 plans complete

**Wave 1**

- [x] 06-01-PLAN.md — Wave 1: pitch.ts 37×26 replacement + pitch.test.ts rewrite + client scaffold (package.json, tsconfig, vite.config, vitest.config, index.html, main.tsx) + hexToPixel.ts + Zustand store + store tests + 4 mock states

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 06-02-PLAN.md — Wave 2: HexGrid + HexCell + PieceOverlay + BallMarker + GameBoard layout

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 06-03-PLAN.md — Wave 3: TurnIndicator + ActionLog + LobbyScreen + App root + full build verification + human checkpoint

**UI hint**: yes

### Phase 7: Client-Server Integration

**Goal:** The React client connects to the live server via Socket.io; a two-player local session is fully playable end-to-end, with undo, connection status feedback, and opponent-disconnect handling.
**Depends on:** Phase 4, Phase 6
**Requirements:** UNDO-01, UNDO-02, UNDO-03, UNDO-04
**Success Criteria**:

1. Opening two browser tabs, creating a room in one and joining in the other, produces a live board in both tabs that updates identically after every server action broadcast
2. Clicking a piece in the active player's tab highlights valid moves; clicking a destination emits `game:move`; the server validates, broadcasts updated state, and both boards update within one round-trip
3. The active player can click Undo to reverse their own movement step (restoring piece position and decrementing move counter); Undo is unavailable after a dice roll result has been received; the opposing player's tab shows no Undo control
4. A connection status indicator (green/yellow/red) reflects live socket state; if the opponent disconnects, the active player sees a disconnect-warning banner within the grace period window
5. The complete flow — lobby → match → piece movement → passing → shooting — runs without a server restart across a full local session between two browser tabs

**Plans:** 4/4 plans complete

**Wave 1**

- [x] 07-01-PLAN.md — socket.ts singleton + Vite proxy + Zustand store extension (emitters, playerSlot/roomCode, movePiece→emitMove) + store tests
- [x] 07-04-PLAN.md — game:shot event (D-06): GAME_SHOT in shared events + ClientToServerEvents, server game:shot handler (phase/team/payload guards, records room.shotTarget, no broadcast, dice resolution unchanged) + integration tests

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 07-02-PLAN.md — App.tsx central socket listener hub (connect-on-mount, 5 named handlers, cleanup) + LobbyScreen real room:create/room:join wiring
- [x] 07-03-PLAN.md — ActionPanel (buttons + PassTypeSelector + undo gating) + ConnectionStatus + DisconnectBanner + GameBoard wiring + HexGrid/HexCell SHOT click routing (emits game:shot per D-06) + ActionPanel tests

**UI hint**: yes

### Phase 7.1: UI Cleanup (INSERTED)

**Goal:** Address UX rough edges discovered during Phase 7 UAT — lobby flow polish, join UX improvements, connection indicator correctness, and team starting position correctness — so the game is clean and intuitive before Phase 8 adds match lifecycle complexity.
**Depends on:** Phase 7
**Requirements:** TEAM-01, TEAM-02, PITCH-02, PITCH-03, CONN-02, CONN-03
**Success Criteria**:

1. Both squads start in a valid 4-5-2 formation on the real 37x26 board (home half q<=18, away mirrored across q=18); None of the selected packages has a "test" script passes
2. Difficult-angle hexes are relocated to the 4 corner-kick zones and still apply the -1 penalty (PITCH-03); pitch.test.ts asserts corner hexes are difficult and old penalty hexes are not
3. JoinRoomScreen submits on Enter and shows a loading/disabled Join button until the server responds (CONN-02); WaitingScreen instructs the user to share the code (CONN-03)
4. Clicking any piece opens a stats panel showing name, role, and all 10 attributes for both players, as local client state only (TEAM-02)
5. Pitch markings (halfway line, centre circle, penalty boxes, 6-yard boxes, corner arcs, goal nets) render; goal-region hexes use grass fill, not black (PITCH-02)
6. No console.log statements remain in App.tsx or LobbyScreen.tsx; full client + shared test suites pass

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 07.1-01-PLAN.md — Shared data: 4-5-2 team positions (D-01) + corner-kick difficult-angle hexes (D-11) + pitch.test.ts
- [x] 07.1-02-PLAN.md — Client lobby UX (D-02/03/04) + debug cleanup + goal-hex grass fill (D-10)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 07.1-03-PLAN.md — SVG pitch markings + goal nets (D-07/08/09/12) + PlayerStatsPanel (D-05/06)

### Phase 8: Match Lifecycle + Post-Game Replay

**Goal:** A complete match runs from kick off through two 45-action halves with added time, full-time detection, correct score display, and an automatic post-game replay driven by the server event log.
**Depends on:** Phase 7.1
**Requirements:** MATCH-01, MATCH-02, MATCH-03, MATCH-04, MATCH-05, REPLAY-01, REPLAY-02, REPLAY-03
**Success Criteria**:

1. The action counter decrements correctly for each of the eight action types; at action 45, the server rolls added time (dice + referee Leniency) and continues play for exactly that many additional actions before triggering half-time
2. Half-time transitions the FSM to `HALF_TIME` state; kick off for the second half is taken by the team that did not kick off in the first half; the action counter resets to 0 for the second half
3. The kick off procedure enforces correct piece placement — one player on the centre hex, attacking team in the centre circle, defending team outside — and requires the game to start with a Standard Pass from the centre hex
4. At full time, both clients display the final score and a post-game replay begins automatically, advancing one action per second through the server event log with the board re-rendering each state in sequence
5. Score is displayed and updated on both clients simultaneously after every goal; the final score shown at full time matches the number of goals registered in the event log

**Plans:** 8/8 plans complete
**UI hint**: yes

Plans:

**Wave 1**

- [x] 08-01-PLAN.md — Shared types/events/actionSequence: LastActionType, ELIGIBLE_NEXT_ACTIONS, GameState fields, KICK_OFF_SETUP phase, new client events

**Wave 2** _(blocked on Wave 1)_

- [x] 08-02-PLAN.md — Engine clock + sequence: applyEndTurn +3 min / added-time roll / half-full-time branch, lastActionType across applyRoll, applySnapshot (SNAP-01..03)

**Wave 3** _(blocked on Wave 2 — same gameEngine.ts)_

- [x] 08-03-PLAN.md — Engine lifecycle: applyKickOffReady (MATCH-03), applyHalfTimeStart (MATCH-04), buildReplayFrames (REPLAY-02/03), Room.replayTimer + readyPlayers

**Wave 4** _(blocked on Wave 3)_

- [x] 08-04-PLAN.md — Handlers: game:ready / game:kick-off-move / game:half-time-start, sequence validation + added-time injection, FULL_TIME→REPLAY setInterval streaming

**Wave 5** _(blocked on Wave 1 + Wave 4)_

- [x] 08-05-PLAN.md — Client routing + screens: store Screen/emitters, App phase routing, HalfTimeScreen, FullTimeScreen, KickOffSetupPanel

**Wave 6** _(blocked on Wave 5 — has checkpoint)_

- [x] 08-06-PLAN.md — In-board client: HexGrid kick-off overlays, ActionPanel eligibility + Snapshot/Header, header match-time, ReplayPanel + full-lifecycle human verify

### Phase 08.1: cleanup player stats, ball control, movement, tackling (INSERTED)

**Goal:** Fix four foundational gameplay issues: (1) all player attributes corrected to 1–6 scale with tier-balanced squads; (2) steal attempt changed to a dribbling-vs-tackling duel; (3) movement UX fixed so pieces stay selected after each step; (4) ZoI hexes visually distinct from safe move hexes.
**Requirements**: MOVE-04, MOVE-05, TEAM-01, TEAM-02
**Depends on:** Phase 8
**Plans:** 3 plans

Plans:

**Wave 1**

- [ ] 08.1-01-PLAN.md — Shared data: rebalance both squads to the 1–6 scale, tier-balanced 1/2/3/3/2 (D-01..D-04, TEAM-01/02)
- [ ] 08.1-02-PLAN.md — Engine/mechanics: TACKLE_ATTEMPT types + validator, die===6 steal fix, tackle duel resolution, ball.position fix, dice-injection refactor (D-05..D-14, MOVE-04/05)

**Wave 2** _(blocked on Wave 1 — client imports extended shared types)_

- [ ] 08.1-03-PLAN.md — Client UX: sticky selection, ZoI-risk hex tint, directional ball possession dot + human verify (D-15..D-21, MOVE-05)

### Phase 08.2: Passing Cleanup (INSERTED)

**Goal:** Passing actions work end-to-end: player selects a target hex, rolls for accuracy using the correct attribute per pass type (dribbling for Standard/First-time/Long, highPass for High), ball moves to target on accurate pass, LOOSE_BALL on inaccurate, adjacent defenders may intercept.
**Requirements**: PASS-01, PASS-02, PASS-03, PASS-04, PASS-05
**Depends on:** Phase 8.1
**Plans:** TBD

Plans:

- [ ] TBD (run /gsd-plan-phase 08.2 to break down)

### Phase 08.3: Remaining Action Flows + Tech Debt (INSERTED)

**Goal:** All remaining broken game actions work (shot declaration, snapshot, header button); code review BLOCKER and WARNINGs from Phase 8 are resolved; human UAT items (snapshot full-path, header path) are verified end-to-end.
**Requirements**: SHOT-01, SHOT-02, SHOT-03, SHOT-04, SNAP-02, SNAP-03, HEAD-01, HEAD-02, HEAD-03, HEAD-04, HEAD-05
**Depends on:** Phase 8.2
**Plans:** TBD

Plans:

- [ ] TBD (run /gsd-plan-phase 08.3 to break down)

### Phase 9: AWS Deployment

**Goal:** The server runs on AWS Elastic Beanstalk and the client is served from S3 + CloudFront; a two-player session over the public internet completes a full match without dropped connections.
**Depends on:** Phase 8
**Requirements:** ARCH-05, ARCH-06
**Success Criteria**:

1. `eb deploy` succeeds; the Elastic Beanstalk environment passes its ALB health check at `GET /health` and the Socket.io server is reachable from a remote browser
2. The React production build is deployed to S3 and served via CloudFront; the client loads over HTTPS with no mixed-content errors and connects to the EB-hosted server via WebSocket
3. The Socket.io client is configured with `transports: ['websocket']` only (no polling fallback); two players on separate networks complete a full match without connection drops attributed to ALB idle timeout (ALB timeout set to 3600s)
4. All environment-specific values (server URL, port, CORS origin) are supplied via Elastic Beanstalk environment variables (`eb setenv`) and not hardcoded in the build artefacts
5. A smoke test — two human players on separate machines completing a kick off, one Movement Phase, one pass, and one shot — passes without server errors in the EB logs

**Plans:** TBD

---

## Progress

| Phase                                       | Plans Complete | Status      | Completed  |
| ------------------------------------------- | -------------- | ----------- | ---------- |
| 1. Monorepo Scaffold + Shared Types         | 3/3            | Complete    | 2026-05-28 |
| 2. Move Validator + Unit Tests              | 4/4            | Complete    | 2026-05-29 |
| 3. Server Room Manager + Socket.io Scaffold | 3/3            | Complete    | 2026-05-29 |
| 4. Game Engine + Phase FSM                  | 3/3            | Complete    | 2026-05-30 |
| 5. Dice Resolver + All Resolution Branches  | 4/4            | Complete    | 2026-05-30 |
| 6. React Hex Grid Renderer                  | 3/3            | Complete    | 2026-05-31 |
| 7. Client-Server Integration                | 4/4            | Complete    | 2026-06-03 |
| 7.1. UI Cleanup                             | 3/3            | Complete    | 2026-06-04 |
| 8. Match Lifecycle + Post-Game Replay       | 8/8            | Complete    | 2026-06-05 |
| 9. AWS Deployment                           | 0/0            | Not started | -          |
