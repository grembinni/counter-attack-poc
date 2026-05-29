# Phase 4: Game Engine + Phase FSM - Research

**Researched:** 2026-05-29
**Domain:** TypeScript game engine — finite state machine, team data, pitch region encoding, action log
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Slot advancement uses an explicit `game:end-turn` event — the active player decides when their slot is done. The server does NOT auto-advance when quota is met.
- **D-02:** Movement quotas are always optional. A player may end their turn having moved fewer pieces than their quota allows. Unused moves are forfeited.
- **D-03:** One unified `game:end-turn` event handles all intra-Movement-Phase advances (ATTACKER_4 → DEFENDER_5 → ATTACKER_2). The server reads `movementSlot` to know what to advance.
- **D-04:** After ATTACKER_2 ends, the FSM auto-transitions to PASS phase — no additional event from the client.
- **D-05:** Valid destination hexes are computed client-side using `validateMove()` from `@counter-attack/shared`. No server round-trip on piece selection.
- **D-06:** The server re-validates every `game:move` event. On rejection, it emits a `game:error` event with a typed reason string and re-broadcasts current state.
- **D-07:** Each move is recorded as an action delta appended to `GameState.eventLog`. Shape: `{ type, pieceId?, from?, to?, slot, timestamp }`.
- **D-08:** `GameState.eventLog` typed as `readonly ActionEvent[]` — replaces existing `readonly unknown[]` in types.ts.
- **D-09:** Undo is allowed for all moves within the current slot until the first `SLOT_ADVANCE` or `DICE_ROLL` entry in the log. Once either appears, moves in that slot are committed.
- **D-10:** The `game:undo` event triggers undo. Server pops the last `MOVE` delta from the log and reverses the piece position.
- **D-11:** The same action log is the source of truth for Phase 8 end-of-game replay.
- **D-12:** Real GameState is built immediately when the second player joins — replacing the stub LOBBY state that Phase 3 created.
- **D-13:** Home/away team assignment uses a random coin flip at match start.
- **D-14:** After GameState is built, the FSM auto-advances LOBBY → KICK_OFF without waiting for a player event.
- **D-15:** MOVE-06 IN SCOPE for Phase 4. After possession switches to a different final third, all pieces in the opposite final third receive a free 6-hex move (attacking team first). Phase 4's pitch region encoding unblocks this.
- **D-16:** MOVE-07 DEFERRED to Phase 5.

### Claude's Discretion

- Delta shape for action log entries: `{ type: ActionEventType, pieceId?: string, from?: HexCoord, to?: HexCoord, slot: MovementSlot | null, timestamp: number }`. Claude should define a proper discriminated union in types.ts.
- Kick-off hex assignment and starting positions for pieces: follow physical board convention (derived from pitch region encoding, not arbitrary).
- Referee card Leniency attribute range: Claude picks a reasonable range (e.g., 1–10 matching other attributes).

### Deferred Ideas (OUT OF SCOPE)

- MOVE-07 (snapshot during movement): detected in Phase 4, resolved in Phase 5.
- Real board measurements for pitch.ts: exact axial (q, r) coordinates remain a HARD BLOCK until user provides photo/measurements. Phase 4 encodes pitch regions using the placeholder grid — sufficient for region checks but not pixel-accurate rendering.
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                                                                | Research Support                                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| TEAM-01  | Two hardcoded squads (11 players each) with 9 attributes each (Pace, Shooting, Tackling, Dribbling, Heading, Saving, Handling, Resilience, Aerial Ability) | `PlayerPiece` type in types.ts already has all 9 fields; need concrete attribute values for two squads and a `teams.ts` data file in shared        |
| TEAM-02  | Player cards display name, position, and all attributes during their team's turn                                                                           | Server-only phase — no UI rendering. Requires `name` and `position` (e.g., GK/DEF/MID/FWD) fields added to `PlayerPiece` for client use in Phase 6 |
| TEAM-03  | A referee card with a Leniency attribute is randomly assigned at match start and stored in game state                                                      | Requires `RefereeCard` type and a `refereeCard` field added to `GameState`; assigned during `buildInitialGameState()`                              |
| PITCH-01 | Hex grid pitch renders the Counter Attack board layout using axial (q, r) coordinates                                                                      | Placeholder grid exists; Phase 4 adds region metadata on top without replacing the placeholder (Phase 6 concern)                                   |
| PITCH-02 | Pitch regions encoded: final thirds, penalty areas, 6-yard boxes, centre circle, kickoff hex                                                               | Requires a `PitchRegions` data structure mapping region names to sets of hex coords derived from placeholder grid dimensions                       |
| PITCH-03 | Difficult shooting angle hexes (dot-marked) encoded and apply -1 dice penalty                                                                              | Requires a `DIFFICULT_ANGLE_HEXES` set of HexCoords added to shared; used by shotValidator in Phase 5                                              |

</phase_requirements>

---

## Summary

Phase 4 is a pure server-side TypeScript phase that wires four tightly coupled subsystems: hardcoded team data, pitch region encoding, an explicit FSM enforcing the 4-5-2 movement sequence, and a typed action log that supports single-turn undo and replay. No new packages are required — the project's existing stack (Socket.io 4.x, shared validators, the `isProcessing` mutex, `broadcastState`) provides every integration point.

The codebase is in excellent shape for this phase. All 103 shared tests and 23 server tests are green. The build is clean. The `validateMove()` function already implements the 4-5-2 slot semantics (including `ATTACKER_2`'s 2-hex cap and `ALREADY_MOVED_IN_ATTACKER4` check). The `PlayerPiece` type already carries all 9 attribute fields. Phase 4's task is to wire these pieces together: create team data, encode pitch regions, build the FSM, add `game:end-turn` / `game:undo` / `game:error` event wiring, and replace the stub LOBBY GameState with a real initialised state.

**Primary recommendation:** Implement in three waves: (1) extend shared types and data (ActionEvent, teams, pitch regions), (2) build the FSM and game engine functions, (3) wire handlers into the server and add integration tests.

---

## Architectural Responsibility Map

| Capability                            | Primary Tier           | Secondary Tier     | Rationale                                                                  |
| ------------------------------------- | ---------------------- | ------------------ | -------------------------------------------------------------------------- |
| 4-5-2 slot sequencing enforcement     | API / Backend (server) | —                  | Server-authoritative; client only computes valid moves locally (D-05)      |
| Valid move computation (highlighting) | Browser / Client       | —                  | D-05: no round-trip on piece selection                                     |
| Move re-validation on `game:move`     | API / Backend (server) | —                  | ARCH-01: server is sole authority on state transitions                     |
| Action log (eventLog)                 | API / Backend (server) | —                  | UX-03/UX-04: server memory, source of truth for replay                     |
| Undo boundary tracking                | API / Backend (server) | —                  | D-09: log entry presence is the guard; server owns the log                 |
| Pitch region encoding                 | Shared package         | Server consumption | Pure data + predicates; no I/O; importable in both client and server       |
| Team data (player attributes)         | Shared package         | Server consumption | Same rationale — pure data, used by validators and server engine           |
| Coin flip / referee card assignment   | API / Backend (server) | —                  | Requires randomness; server generates all random values (STATE.md pitfall) |
| isProcessing mutex                    | API / Backend (server) | —                  | Per-room concurrency guard; already on Room type from Phase 3              |
| FSM state transitions                 | API / Backend (server) | —                  | ARCH-01; clients observe state via broadcasts, never advance FSM directly  |

---

## Standard Stack

### Core (no new packages needed)

| Library                    | Version                | Purpose                           | Why Standard                                  |
| -------------------------- | ---------------------- | --------------------------------- | --------------------------------------------- |
| socket.io (server)         | 4.8.3 (installed)      | WebSocket event transport         | Already installed; project constraint         |
| @counter-attack/shared     | workspace:\*           | Types, hex math, validators       | Already built; Phase 4 extends it             |
| Node.js `crypto.randomInt` | built-in (Node 24 LTS) | Coin flip, referee card selection | STATE.md: never generate randomness on client |

No additional npm packages are needed for Phase 4. All required primitives exist in the installed stack. [VERIFIED: codebase — packages/server/package.json and packages/shared/package.json]

### Supporting (already installed)

| Library          | Version                   | Purpose                      | When to Use                         |
| ---------------- | ------------------------- | ---------------------------- | ----------------------------------- |
| vitest           | 2.1.9 (installed)         | Unit and integration testing | All new modules need unit tests     |
| socket.io-client | 4.8.3 (installed, devDep) | Integration test client      | `gameHandlers.ts` integration tests |

**No installation step required for Phase 4.** All dependencies are present.

---

## Package Legitimacy Audit

> No new packages are introduced in Phase 4. All dependencies were installed and verified in Phase 3.

| Package    | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
| ---------- | -------- | --- | --------- | ----------- | --------- | ----------- |
| (none new) | —        | —   | —         | —           | N/A       | N/A         |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Client A (active player)          Server                          Client B (observer)
       |                             |                                    |
       |  game:move(from, to)        |                                    |
       |--------------------------->|                                    |
       |                             |  1. acquire isProcessing mutex     |
       |                             |  2. find room + piece              |
       |                             |  3. validateMove(state, piece, to) |
       |                             |     — WRONG_SLOT / OUT_OF_RANGE    |
       |                             |     — OCCUPIED / PACE_EXCEEDED     |
       |                             |     — ZoI: STEAL_ATTEMPT effect    |
       |                             |  4a. ok:false → game:error reason  |
       |  game:error(reason)  <------|     + broadcastState (snap-back)    |
       |  game:state(current) <------|                                    |
       |                             |  4b. ok:true →                    |
       |                             |     update piece position          |
       |                             |     decrement movesRemaining       |
       |                             |     append MOVE ActionEvent        |
       |                             |     release mutex                  |
       |                             |  broadcastState(io, room)          |
       |  game:state(new)    <-------|------------------------------------->
       |                             |                                    |
       |  game:end-turn              |                                    |
       |--------------------------->|                                    |
       |                             |  FSM.advanceSlot(state)            |
       |                             |  ATTACKER_4 → DEFENDER_5           |
       |                             |  DEFENDER_5 → ATTACKER_2           |
       |                             |  ATTACKER_2 → PASS (auto)          |
       |                             |  append SLOT_ADVANCE ActionEvent   |
       |                             |  broadcastState(io, room)          |
       |  game:state(new)    <-------|------------------------------------->
       |                             |                                    |
  [Initialisation — when P2 joins]  |                                    |
       |                             |  buildInitialGameState(room)       |
       |                             |  coinFlip → home/away assign       |
       |                             |  place 22 pieces + ball            |
       |                             |  assign referee card               |
       |                             |  FSM: LOBBY → KICK_OFF             |
       |                             |  broadcastState(io, room)          |
       |  game:state(KICK_OFF) <-----|------------------------------------->
```

### Recommended Project Structure

New files for Phase 4 (all in existing packages, no new directories needed):

```
packages/shared/src/
├── types.ts            # EXTEND: ActionEvent union, RefereeCard, updated GameState
├── events.ts           # EXTEND: GAME_END_TURN, GAME_UNDO, GAME_ERROR constants + typed maps
├── teams.ts            # NEW: HOME_SQUAD, AWAY_SQUAD — 11 PlayerPiece records each
├── pitch.ts            # EXTEND: PitchRegions object, DIFFICULT_ANGLE_HEXES set, isPitchHex()
├── pitchRegions.ts     # (alternative split) — region predicates; keep in pitch.ts to avoid barrel bloat
└── index.ts            # EXTEND: export new symbols (teams, ActionEvent, RefereeCard)

packages/server/src/
├── gameEngine.ts       # NEW: buildInitialGameState(), FSM.advanceSlot(), applyMove()
├── gameHandlers.ts     # NEW: registerGameHandlers(io, socket) — game:move, game:end-turn, game:undo
└── createServer.ts     # EXTEND: call registerGameHandlers in connection handler
```

### Pattern 1: Explicit FSM Object

**What:** A plain TypeScript object (not a class) with an `advanceSlot` function that reads `movementSlot` and returns the next slot or triggers phase transition. No if/else chains in handlers.

**When to use:** All slot transition logic is consolidated here. Handlers call `fsm.advanceSlot(state)` — they do not contain slot-transition logic inline.

**Why:** STATE.md locked decision: "Explicit FSM object for game phases (not if/else chains)."

```typescript
// Source: locked decision in STATE.md; pattern established in CONTEXT.md
export type MovementSlot = 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2';

const SLOT_SEQUENCE: MovementSlot[] = ['ATTACKER_4', 'DEFENDER_5', 'ATTACKER_2'];

export function advanceMovementSlot(state: GameState): {
  nextSlot: MovementSlot | null;
  nextPhase: GamePhase;
} {
  const idx = SLOT_SEQUENCE.indexOf(state.movementSlot!);
  if (idx === SLOT_SEQUENCE.length - 1) {
    // D-04: ATTACKER_2 done → auto-transition to PASS
    return { nextSlot: null, nextPhase: 'PASS' };
  }
  return { nextSlot: SLOT_SEQUENCE[idx + 1]!, nextPhase: 'MOVEMENT' };
}
```

[ASSUMED] — specific implementation shape; locked decision is to use an explicit FSM object.

### Pattern 2: isProcessing Mutex (Established in Phase 3)

**What:** `room.isProcessing` is set `true` at handler entry, released in `finally`. Already on `Room` type.

**When to use:** Every `game:move`, `game:end-turn`, `game:undo` handler.

```typescript
// Source: roomStore.ts — isProcessing field pre-loaded for Phase 4
socket.on(ClientEvents.GAME_MOVE, (from, to) => {
  const room = getRoom(socket.data.roomCode!);
  if (!room || room.isProcessing) return; // drop silently per Phase 4 success criterion 5
  room.isProcessing = true;
  try {
    // ... validate and apply move ...
  } finally {
    room.isProcessing = false;
  }
});
```

[ASSUMED] — specific code shape; the isProcessing mutex pattern is a locked decision from STATE.md.

### Pattern 3: Guard-First Early Returns (Established in Phase 2/3)

**What:** Check failure conditions first, return early, happy path last.

**When to use:** All handler entry points. Established in moveValidator.ts and roomHandlers.ts.

```typescript
// Source: moveValidator.ts guard precedence — established pattern
if (state.movementSlot === null) return { ok: false, reason: 'WRONG_SLOT' };
if (hexDistance(piece.position, to) !== 1) return { ok: false, reason: 'OUT_OF_RANGE' };
// ... more guards ...
return { ok: true };
```

[VERIFIED: codebase — packages/shared/src/moveValidator.ts]

### Pattern 4: Discriminated Union Results (Established in Phase 2)

**What:** Functions return `{ ok: true; ... } | { ok: false; reason: string }` — never throw.

**When to use:** All FSM action functions (applyMove, advanceSlot). Mirrors `MoveResult` in moveValidator.ts.

### Pattern 5: ActionEvent Discriminated Union

**What:** The action log entries use a discriminated union on `type` so downstream consumers (replay, undo) can narrow types safely.

**Design (Claude's discretion from D-07):**

```typescript
// Source: D-07 and D-08 from CONTEXT.md; shape is Claude's discretion
export type ActionEventType =
  | 'MOVE'
  | 'SLOT_ADVANCE'
  | 'DICE_ROLL'
  | 'STEAL_ATTEMPT'
  | 'GOAL'
  | 'KICK_OFF';

export type ActionEvent =
  | {
      type: 'MOVE';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      slot: MovementSlot;
      timestamp: number;
    }
  | { type: 'SLOT_ADVANCE'; from: MovementSlot; to: MovementSlot | null; timestamp: number }
  | { type: 'DICE_ROLL'; result: number; timestamp: number }
  | { type: 'STEAL_ATTEMPT'; defenderId: string; result: 'SUCCESS' | 'FAIL'; timestamp: number }
  | { type: 'GOAL'; scoringTeam: 'home' | 'away'; timestamp: number }
  | { type: 'KICK_OFF'; timestamp: number };
```

[ASSUMED] — specific type shape is Claude's discretion per D-07/D-08.

### Anti-Patterns to Avoid

- **Auto-advancing the slot when quota is met:** D-01 locks this — only `game:end-turn` advances slots. No quota-monitoring logic in `applyMove`.
- **Emitting dice from the client:** STATE.md pitfall — all randomness (coin flip, referee card) uses `crypto.randomInt` server-side.
- **Nested if/else slot chains in handlers:** Locked out by STATE.md — use `advanceMovementSlot()` function.
- **Reading `socket.rooms` in handlers:** Established anti-pattern from Phase 3 — read `socket.data.roomCode` instead.
- **Mutating `state.pieces` directly:** GameState uses `readonly` arrays. Create new arrays: `[...state.pieces.map(...)]`.
- **Storing `movementSlot` on the FSM object:** It lives on `GameState`, not a separate FSM instance. The FSM is stateless pure functions operating on GameState.
- **Putting team data in the server package:** Team data and pitch region predicates belong in `packages/shared` so Phase 6 client can import them without a server round-trip.

---

## Don't Hand-Roll

| Problem                                   | Don't Build                | Use Instead                                                      | Why                                                           |
| ----------------------------------------- | -------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| Hex distance checks for region membership | Custom range loops         | `hexesInRange(center, range)` from hex.ts                        | Already tested, handles all 6 directions correctly            |
| ZoI detection                             | Inline adjacency check     | `getZoIDefenders(pos, opponents)` from hex.ts                    | Returns typed `PlayerPiece[]` for discriminated union         |
| Move validation                           | Re-implementing in handler | `validateMove(state, piece, to)` from moveValidator.ts           | Already handles all 5 reject paths + ZoI effect               |
| Combination scoring                       | Inline attribute+dice math | `computeCombinedScore(attr, dice, penalties)` from scoreUtils.ts | DICE-04 penalty cap handled correctly                         |
| Loose Ball destination                    | Inline direction table     | `computeLooseBall(from, dir, dist)` from scoreUtils.ts           | Direction map matches rulebook (pending Phase 5 verification) |
| State broadcast                           | Custom emit logic          | `broadcastState(io, room)` from roomStore.ts                     | ARCH-04 contract; single entry point                          |
| Unique IDs                                | Custom ID generation       | Use piece index + team prefix (`'home-0'` through `'home-10'`)   | No UUID needed — deterministic IDs simplify test assertions   |

**Key insight:** Phase 4 adds wiring and data, not new algorithms. Every algorithmic primitive it needs already exists in the Phase 2 shared package.

---

## Codebase Integration Map

This section documents every file that Phase 4 must modify or create, with the exact change type.

### packages/shared/src/types.ts — EXTEND

Current state: `PlayerPiece` has all 9 attributes but lacks `name: string` and `position: 'GK' | 'DEF' | 'MID' | 'FWD'`. `GameState.eventLog` is `readonly unknown[]`. No `RefereeCard` type.

Required additions:

1. Add `name: string` and `role: 'GK' | 'DEF' | 'MID' | 'FWD'` to `PlayerPiece` (TEAM-02 data model)
2. Add `RefereeCard` type: `{ leniency: number }` (TEAM-03)
3. Replace `eventLog: readonly unknown[]` with `eventLog: readonly ActionEvent[]` (D-08)
4. Add `refereeCard: RefereeCard` to `GameState` (TEAM-03)
5. Add `ActionEvent` discriminated union (D-07, D-08)
6. Add `ActionEventType` string union

**Note:** `movementSlot: 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2' | null` already exists on `GameState`. Export it as a named type `MovementSlot` for use in `ActionEvent`.

### packages/shared/src/events.ts — EXTEND

Current state: `ClientEvents` has ROOM_CREATE, ROOM_JOIN, GAME_MOVE, GAME_ROLL. `ServerEvents` has ROOM_JOINED, ROOM_ERROR, GAME_STATE, GAME_DISCONNECT_WARNING. No end-turn, undo, or game-error entries.

Required additions:

1. `GAME_END_TURN: 'game:end-turn'` to `ClientEvents`
2. `GAME_UNDO: 'game:undo'` to `ClientEvents`
3. `GAME_ERROR: 'game:error'` to `ServerEvents`
4. `[ClientEvents.GAME_END_TURN]: () => void` to `ClientToServerEvents`
5. `[ClientEvents.GAME_UNDO]: () => void` to `ClientToServerEvents`
6. `[ServerEvents.GAME_ERROR]: (reason: string) => void` to `ServerToClientEvents`

### packages/shared/src/teams.ts — NEW

Two complete 11-player squads as `readonly PlayerPiece[]` constants.

**Attribute design considerations (Claude's discretion):**

- All attributes are integers 1–10, matching the game's published card format
- GK: high Saving (8–10), Handling (7–9), low Pace (2–4), Shooting (1–2)
- DEF: high Tackling (7–9), moderate Pace (4–6), low Shooting (2–4)
- MID: balanced across Pace/Dribbling/Passing-proxied-by-Heading (5–7)
- FWD: high Pace (7–9), Shooting (7–9), low Tackling (1–3), Saving (1)
- Piece IDs: deterministic, e.g., `'home-0'` through `'home-10'` and `'away-0'` through `'away-10'`
- Starting positions: placed in their half using the placeholder grid coordinates (q range 0–11 for home, 12–24 for away on the 25-wide placeholder grid); exact positions are approximate until Phase 6 real board coordinates

**Referee card:** A single `RefereeCard` value with `leniency` in range 1–6 (matches dice face range, per MATCH-02 "dice roll + referee Leniency"). One card is randomly selected from a small pool at match start, or a single static card is used. Claude's discretion — single static card `{ leniency: 3 }` is simplest for Phase 4, with randomisation added in Phase 8. [ASSUMED]

### packages/shared/src/pitch.ts — EXTEND

Current state: `PITCH_HEXES` is a 25×16 rectangular grid placeholder.

Required additions (using the placeholder grid — HARD BLOCK for accurate coords is Phase 6):

1. `PitchRegions` type and `PITCH_REGIONS` constant mapping region names to `Set<string>` (using `"q,r"` string keys for O(1) membership tests)
2. Region definitions derived from placeholder 25×16 grid:
   - `homeThird`: q 0–7
   - `awayThird`: q 17–24
   - `middleThird`: q 8–16
   - `homePenaltyArea`: q 0–3, r 4–11 (approximation)
   - `awayPenaltyArea`: q 21–24, r 4–11 (approximation)
   - `homeSixYardBox`: q 0–1, r 6–9 (approximation)
   - `awaySixYardBox`: q 23–24, r 6–9 (approximation)
   - `centreCircle`: hexesInRange({ q: 12, r: 7 }, 3) — approximate centre
   - `kickOffHex`: `{ q: 12, r: 7 }` (centre of placeholder grid)
3. `DIFFICULT_ANGLE_HEXES`: Set of HexCoords for dot-marked positions. On the physical board, difficult-angle hexes are the two columns immediately beside each post at a sharp angle. Approximation on placeholder grid: q 2–3, r 3–4 and q 2–3, r 10–11 for home end; symmetric for away end. [ASSUMED — requires physical board verification in Phase 6]
4. Helper predicate: `isInRegion(hex: HexCoord, region: keyof PitchRegions): boolean`
5. Helper: `isPitchHex(hex: HexCoord): boolean` — used for Loose Ball boundary enforcement (referenced in scoreUtils.ts)

**Note:** CONTEXT.md confirms that these region approximations are sufficient for Phase 4 rule enforcement (MOVE-06, SNAP-01 detection), even though they are not pixel-accurate. Phase 6 replaces them with real coordinates.

### packages/server/src/gameEngine.ts — NEW

Pure functions (no socket.io imports) that build and mutate GameState:

```typescript
// Source: D-12, D-13, D-14 from CONTEXT.md
export function buildInitialGameState(roomCode: string): GameState;
export function applyMove(state: GameState, pieceId: string, to: HexCoord): ApplyMoveResult;
export function applyEndTurn(state: GameState): ApplyEndTurnResult;
export function applyUndo(state: GameState): ApplyUndoResult;
```

**`buildInitialGameState`:** Uses `crypto.randomInt(0, 2)` for coin flip (D-13), assigns home/away teams, places pieces at starting positions, selects referee card, sets `phase: 'KICK_OFF'` (D-14), sets `movementSlot: null` (movement not yet started).

**`applyMove`:** Calls `validateMove(state, piece, to)`. On `ok:false`, returns rejection result. On `ok:true`, returns new GameState with piece repositioned + `ActionEvent` appended to `eventLog`. Does NOT auto-advance slot (D-01).

**`applyEndTurn`:** Reads `movementSlot`, calls `advanceMovementSlot(state)`, returns new GameState with updated `movementSlot`/`phase` and `SLOT_ADVANCE` event appended. Resets `movedPieceIds` and `paceUsedByPieceId` for the new slot.

**`applyUndo`:** Checks undo eligibility (D-09: no `SLOT_ADVANCE` or `DICE_ROLL` in current slot's log entries). If eligible, pops the last `MOVE` event and reverses the piece position and `paceUsedByPieceId` entry.

**MOVE-06 implementation in `applyMove`:** After applying a valid move, check if the ball carrier crossed into a new final third (compare `piece.teamId`'s current final third vs. destination). If yes, set a flag in GameState (e.g., `pendingFreeMove: { team: ..., hexesAllowed: 6 }`) and do NOT advance slot automatically. The client/handler recognises this state flag to prompt the free-move sequence. [ASSUMED — exact free-move state shape is Claude's discretion]

### packages/server/src/gameHandlers.ts — NEW

Registers `game:move`, `game:end-turn`, and `game:undo` event handlers. Mirrors `registerRoomHandlers` pattern from roomHandlers.ts.

```typescript
// Source: CONTEXT.md Integration Points + established patterns
export function registerGameHandlers(io: AppServer, socket: AppSocket): void;
```

Each handler: acquire isProcessing mutex → validate socket context (room, slot, game phase) → call appropriate gameEngine function → call broadcastState → release mutex.

### packages/server/src/createServer.ts — EXTEND

Add `registerGameHandlers(io, socket)` call in the connection handler's fresh-connection path (alongside `registerRoomHandlers`). Also add it in the reconnect path.

### packages/server/src/roomStore.ts — EXTEND

`joinRoom()` currently sets a stub `GameState` with `phase: 'LOBBY'`. Phase 4 replaces this with a call to `buildInitialGameState(roomCode)` — importing from `gameEngine.ts`. This satisfies D-12.

**Note:** `broadcastState` is unchanged. `Room.gameState` type is unchanged (`GameState | null`).

---

## Common Pitfalls

### Pitfall 1: Mutating Readonly Arrays

**What goes wrong:** TypeScript's `readonly` arrays and `Readonly<Record<...>>` block direct mutation. `state.pieces.push(...)` or `state.eventLog.push(...)` fails at compile time.

**Why it happens:** GameState uses `readonly` collections to enforce immutability at the type level.

**How to avoid:** Return new state objects: `{ ...state, pieces: [...state.pieces.map(p => p.id === pieceId ? {...p, position: to} : p)], eventLog: [...state.eventLog, newEvent] }`.

**Warning signs:** TypeScript error "Cannot assign to ... because it is a read-only property."

### Pitfall 2: Active Team vs. Moving Team Confusion

**What goes wrong:** DEFENDER_5 is the defender's slot — `activeTeam` flips between home and away depending on which team is the attacker. If `activeTeam` always tracks the attacker, the defender's slot needs careful handling.

**Why it happens:** The 4-5-2 sequence is asymmetric: attacker moves 4, then defender moves 5, then attacker moves 2 more. The "active" player changes mid-Movement-Phase.

**How to avoid:** Track `attackingTeam` (set when the Movement Phase begins, constant for the whole phase) separately from which team is currently acting. The slot to team mapping: ATTACKER_4 → attackingTeam, DEFENDER_5 → the other team, ATTACKER_2 → attackingTeam. Handlers validate `socket.data.playerSlot` against the currently acting team. [ASSUMED — tracking approach is Claude's discretion]

**Warning signs:** Defender pieces being movable during ATTACKER_4 slot.

### Pitfall 3: game:end-turn Called by Wrong Player

**What goes wrong:** Both clients have a socket connection. A `game:end-turn` from the wrong player's socket would advance the slot.

**Why it happens:** Socket events arrive from any connected client.

**How to avoid:** In `gameHandlers.ts`, validate `socket.data.playerSlot` against the team currently holding the active slot. Use a helper `isActivePlayer(socket, room): boolean` that maps slot → team → check.

**Warning signs:** ATTACKER_4 slot ending before the attacker emits end-turn.

### Pitfall 4: Undo After SLOT_ADVANCE is Silently Accepted

**What goes wrong:** D-09 requires checking the current slot's log entries. If the check scans all log entries (not just the current slot), a SLOT_ADVANCE from a previous slot incorrectly blocks undo.

**Why it happens:** The full eventLog contains events from all previous slots.

**How to avoid:** When checking undo eligibility, find only the entries since the last `SLOT_ADVANCE` entry (or from the start if none). `const currentSlotEvents = getEventsForCurrentSlot(state.eventLog, state.movementSlot)`.

**Warning signs:** Undo blocked at the start of a fresh slot.

### Pitfall 5: broadcastState Called Before isProcessing Released

**What goes wrong:** Calling `broadcastState` inside the mutex (before `finally`) then releasing the mutex in `finally` is fine. But if an exception occurs, the mutex might not be released.

**Why it happens:** Missing `finally` block.

**How to avoid:** Always release `room.isProcessing = false` in a `finally` block. Broadcast inside the `try` block before the `finally`.

**Warning signs:** Second action from either player is silently dropped (room stays `isProcessing = true` forever).

### Pitfall 6: pitch.ts Region Encoding Using Array Includes Instead of Set Lookup

**What goes wrong:** Checking region membership with `PITCH_REGIONS.homePenaltyArea.includes(hex)` is O(n) and requires object equality, which fails for `HexCoord` (structural equality needed).

**Why it happens:** Arrays do not use structural equality; `{q:1,r:2} === {q:1,r:2}` is false.

**How to avoid:** Use `Set<string>` with `"q,r"` string keys. Helper: `const hexKey = (h: HexCoord) => \`\${h.q},\${h.r}\``. Then `PITCH_REGIONS.homePenaltyArea.has(hexKey(hex))` is O(1) and structurally correct.

**Warning signs:** `isInRegion` always returns false even for hexes visually inside the region.

### Pitfall 7: Stub Dice for MOVE-06 and Steal Attempts

**What goes wrong:** Phase 4 needs to handle `STEAL_ATTEMPT` effects from `validateMove` and the free-move trigger from MOVE-06. Phase 5 provides real dice. If Phase 4 handlers encounter a `STEAL_ATTEMPT` effect and don't handle it, the action is silently completed without the steal resolution.

**Why it happens:** `validateMove` returns `{ ok: true, effect: { type: 'STEAL_ATTEMPT', defenders } }` when ZoI is triggered.

**How to avoid:** CONTEXT.md §Specific Ideas confirms: use a deterministic stub dice (always return a fixed value, e.g., `3`) for Phase 4. The steal handler calls `stubDice()` and applies the result. Phase 5 replaces `stubDice()` with `crypto.randomInt`. Define the stub in `gameEngine.ts` with a clear `// TODO Phase 5: replace with crypto.randomInt` comment.

**Warning signs:** Ball carrier can freely enter defender ZoI without any steal resolution.

### Pitfall 8: MOVE-06 Free-Move Triggered on Wrong Condition

**What goes wrong:** MOVE-06 fires when "the ball moves to a different final third." This is NOT triggered on every move into the attacker's half — only when the ball crosses from one final third to the other (home third → away third or vice versa).

**Why it happens:** Misreading "final third" as "own half" or triggering on every final-third entry (not just first entry from the opposite third).

**How to avoid:** Track previous ball position's final-third membership. MOVE-06 fires only if `previousFinalThird !== currentFinalThird` and both positions are in different final thirds (middle third crossings don't trigger it). [ASSUMED — rulebook interpretation; should be confirmed against physical rulebook]

**Warning signs:** Free move triggered every time the ball enters the attacking third (including when it was already in the attacking third).

---

## Code Examples

### GameState Extension for Phase 4

```typescript
// Source: CONTEXT.md D-07, D-08, D-12, D-13 — discriminated union shape
export type MovementSlot = 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2';

export type RefereeCard = {
  leniency: number; // 1–6 range, used in Phase 8 for added time calculation
};

export type ActionEvent =
  | {
      type: 'MOVE';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      slot: MovementSlot;
      timestamp: number;
    }
  | { type: 'SLOT_ADVANCE'; from: MovementSlot; to: MovementSlot | null; timestamp: number }
  | { type: 'DICE_ROLL'; result: number; timestamp: number }
  | { type: 'STEAL_ATTEMPT'; defenderId: string; result: 'SUCCESS' | 'FAIL'; timestamp: number }
  | { type: 'GOAL'; scoringTeam: 'home' | 'away'; timestamp: number }
  | { type: 'KICK_OFF'; timestamp: number };

// GameState additions (extend existing type):
// eventLog: readonly ActionEvent[];   (replaces readonly unknown[])
// refereeCard: RefereeCard;
// attackingTeam: 'home' | 'away';    (set at KICK_OFF, constant through Movement Phase)
```

[ASSUMED] — exact shape is Claude's discretion per D-07/D-08.

### isProcessing Mutex in gameHandlers.ts

```typescript
// Source: roomStore.ts isProcessing field + STATE.md pitfall "Add isProcessing mutex before writing any game logic"
socket.on(ClientEvents.GAME_MOVE, (from: HexCoord, to: HexCoord) => {
  const roomCode = socket.data.roomCode;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // success criterion 5: silently drop
  room.isProcessing = true;
  try {
    const state = room.gameState;
    if (state === null || state.phase !== 'MOVEMENT') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    const piece = state.pieces.find((p) => p.id === /* pieceId derived from socket slot */ '...');
    // ... call applyMove, broadcastState ...
  } finally {
    room.isProcessing = false;
  }
});
```

[ASSUMED] — specific handler code; pattern from STATE.md + Phase 3 codebase.

### Set-based Region Lookup

```typescript
// Source: Pitfall 6 analysis — structural equality requirement for HexCoord
const hexKey = (h: HexCoord): string => `${h.q},${h.r}`;

const HOME_PENALTY_AREA_SET: ReadonlySet<string> = new Set(HOME_PENALTY_AREA_HEXES.map(hexKey));

export function isInPenaltyArea(hex: HexCoord, team: 'home' | 'away'): boolean {
  const key = hexKey(hex);
  return team === 'home' ? HOME_PENALTY_AREA_SET.has(key) : AWAY_PENALTY_AREA_SET.has(key);
}
```

[ASSUMED] — implementation pattern; the requirement for Set-based lookup is architectural.

---

## State of the Art

| Old Approach                        | Current Approach                      | When Changed | Impact                                                                     |
| ----------------------------------- | ------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| `eventLog: readonly unknown[]`      | `eventLog: readonly ActionEvent[]`    | Phase 4      | Type-safe log entries; undo and replay can narrow types                    |
| Stub LOBBY GameState in joinRoom    | Real `buildInitialGameState()` output | Phase 4      | Both players see initialised pitch immediately on join                     |
| moveValidator without pitch context | moveValidator + pitch region checks   | Phase 4      | SNAP-01 SNAPSHOT_AVAILABLE effect enabled; Loose Ball boundary enforcement |

**Deprecated/outdated:**

- `GameState.eventLog: readonly unknown[]`: replaced in Phase 4 with `readonly ActionEvent[]`.
- Stub `{ phase: 'LOBBY', pieces: [], ... }` in `roomStore.joinRoom()`: replaced by `buildInitialGameState()` call.

---

## Assumptions Log

| #   | Claim                                                                                                        | Section                             | Risk if Wrong                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `attackingTeam` field added to GameState to track who is the attacker for the full Movement Phase            | Codebase Integration Map, Pitfall 2 | Needs an alternative mechanism to distinguish ATTACKER_4/ATTACKER_2 slots from DEFENDER_5                                         |
| A2  | Referee card `leniency` range 1–6 (matching dice face range for MATCH-02 added time)                         | teams.ts design                     | If rulebook uses different range, Phase 8 added-time calculation changes                                                          |
| A3  | Single static referee card `{ leniency: 3 }` for Phase 4; randomised pool deferred to Phase 8                | teams.ts design                     | If user wants random cards immediately, add a small pool and `crypto.randomInt` selection                                         |
| A4  | Difficult-angle hexes encoded as approximate placeholder positions based on placeholder grid geometry        | pitch.ts PITCH-03                   | Incorrect positions until Phase 6 real board coordinates; -1 dice penalty may fire on wrong hexes                                 |
| A5  | MOVE-06 tracked via a `pendingFreeMove` field on GameState                                                   | gameEngine.ts MOVE-06               | Alternative: a separate `pendingFreeMoveState` FSM phase. Either approach works; shape is Claude's discretion                     |
| A6  | MOVE-06 fires only when ball crosses between different final thirds, not on every entry into attacking third | Pitfall 8                           | If rulebook means "any time ball enters opponent's final third," the condition changes                                            |
| A7  | Piece IDs use deterministic prefix+index scheme (`'home-0'` through `'home-10'`)                             | teams.ts design                     | No functional risk; just affects test assertion readability                                                                       |
| A8  | Stub dice for steal resolution in Phase 4 always returns a fixed value (e.g., 3)                             | Pitfall 7                           | Not a correctness risk — Phase 5 replaces it. If Phase 4 integration tests check steal outcomes, they need to know the stub value |

---

## Open Questions

1. **`game:move` payload shape: piece ID vs. from-coord**
   - What we know: current `ClientToServerEvents` defines `game:move` as `(from: HexCoord, to: HexCoord) => void`
   - What's unclear: the server must identify which piece is moving. Using `from` coord requires a lookup (`pieces.find(p => p.position.q === from.q && p.position.r === from.r)`). Alternatively, the payload could include `pieceId` directly.
   - Recommendation: Add `pieceId: string` to the `game:move` payload (extend `ClientToServerEvents`). The from-coord is redundant if we trust the server's state. This eliminates ambiguity when two pieces occupy adjacent hexes and the client click is near the boundary. [ASSUMED — change to event signature]

2. **`attackingTeam` vs. deriving from `activeTeam`**
   - What we know: `activeTeam: 'home' | 'away'` is already on `GameState`
   - What's unclear: does `activeTeam` track who is currently moving (switches each slot) or who the attacker is (constant per Movement Phase)?
   - Recommendation: Add `attackingTeam: 'home' | 'away'` as the constant for the phase, and make `activeTeam` track the currently-moving team (the one who should be sending actions in this slot).

3. **MOVE-06 free move: does it interrupt the current slot or append after ATTACKER_2?**
   - What we know: "all pieces in the opposite final third get a free 6-hex move (attacking team first)" — D-15
   - What's unclear: does this create a new sub-slot mid-Movement-Phase, or does it append before the next game phase?
   - Recommendation: Treat as a new FSM state `FREE_MOVE` that suspends normal slot advancement. The handler detects `pendingFreeMove` on the state and routes `game:move` through free-move rules. After free-move exhausted, resume normal FSM state. [ASSUMED]

---

## Environment Availability

| Dependency                 | Required By             | Available   | Version                 | Fallback |
| -------------------------- | ----------------------- | ----------- | ----------------------- | -------- |
| Node.js `crypto.randomInt` | Coin flip, referee card | Yes         | Node 24.15.0 (built-in) | —        |
| socket.io 4.x              | Event transport         | Yes (4.8.3) | 4.8.3                   | —        |
| vitest 2.x                 | Test runner             | Yes (2.1.9) | 2.1.9                   | —        |
| pnpm workspace             | Monorepo                | Yes         | 9.x                     | —        |

All environments are available. No missing dependencies.

**Build verification (run at research time):**

- `pnpm -r build`: clean (all 3 packages) [VERIFIED: codebase]
- `pnpm --filter @counter-attack/shared test`: 103 tests, all green [VERIFIED: codebase]
- `pnpm --filter @counter-attack/server test`: 23 tests, all green [VERIFIED: codebase]

---

## Validation Architecture

### Test Framework

| Property                   | Value                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Framework                  | Vitest 2.1.9                                                                       |
| Config file                | `packages/shared/vitest.config.ts` (implicit) / `packages/server/vitest.config.ts` |
| Quick run command (shared) | `pnpm --filter @counter-attack/shared test`                                        |
| Quick run command (server) | `pnpm --filter @counter-attack/server test`                                        |
| Full suite command         | `pnpm -r test`                                                                     |

### Phase Requirements → Test Map

| Req ID         | Behavior                                                               | Test Type       | Automated Command                                                                  | File Exists?                     |
| -------------- | ---------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| TEAM-01        | Both squads have 11 players with all 9 attributes                      | unit            | `pnpm --filter @counter-attack/shared test src/teams.test.ts`                      | No — Wave 0                      |
| TEAM-02        | Players have `name` and `role` fields                                  | unit            | same as TEAM-01                                                                    | No — Wave 0                      |
| TEAM-03        | Referee card is assigned at match start                                | unit            | `pnpm --filter @counter-attack/server test src/__tests__/gameEngine.test.ts`       | No — Wave 0                      |
| PITCH-01       | Placeholder PITCH_HEXES still exports 400 hexes                        | unit (existing) | `pnpm --filter @counter-attack/shared test`                                        | Yes (pitch.ts tested indirectly) |
| PITCH-02       | `isInRegion` returns correct result for known hexes                    | unit            | `pnpm --filter @counter-attack/shared test src/pitch.test.ts`                      | No — Wave 0                      |
| PITCH-03       | `DIFFICULT_ANGLE_HEXES` membership returns correct for known positions | unit            | same as PITCH-02                                                                   | No — Wave 0                      |
| MOVE-01        | game:move from wrong slot returns game:error WRONG_SLOT                | integration     | `pnpm --filter @counter-attack/server test src/__tests__/game.integration.test.ts` | No — Wave 0                      |
| MOVE-02        | game:move exceeding Pace returns game:error PACE_EXCEEDED              | integration     | same                                                                               | No — Wave 0                      |
| MOVE-03        | game:move to occupied hex returns game:error OCCUPIED                  | integration     | same                                                                               | No — Wave 0                      |
| MOVE-04/05     | ball carrier entering ZoI triggers STEAL_ATTEMPT + state update        | integration     | same                                                                               | No — Wave 0                      |
| MOVE-06        | ball crossing final third triggers free-move state                     | integration     | same                                                                               | No — Wave 0                      |
| FSM sequencing | ATTACKER_4 → DEFENDER_5 → ATTACKER_2 → PASS enforced                   | integration     | same                                                                               | No — Wave 0                      |
| D-09/D-10      | game:undo reverses last MOVE; blocked after SLOT_ADVANCE               | integration     | same                                                                               | No — Wave 0                      |
| isProcessing   | Duplicate action during processing is silently dropped                 | unit            | `pnpm --filter @counter-attack/server test src/__tests__/gameEngine.test.ts`       | No — Wave 0                      |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/shared/src/teams.test.ts` — covers TEAM-01, TEAM-02
- [ ] `packages/shared/src/pitch.test.ts` — covers PITCH-02, PITCH-03
- [ ] `packages/server/src/__tests__/gameEngine.test.ts` — covers TEAM-03, isProcessing, applyMove unit, applyEndTurn unit, applyUndo unit
- [ ] `packages/server/src/__tests__/game.integration.test.ts` — covers MOVE-01 through MOVE-06 + FSM sequencing + D-09/D-10 at the wire level

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                             |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| V2 Authentication     | No      | Session identity handled in Phase 3 (sessionMiddleware)                                                      |
| V3 Session Management | No      | Phase 3 concern                                                                                              |
| V4 Access Control     | Yes     | Active-player guard: validate `socket.data.playerSlot` matches the acting team before accepting game actions |
| V5 Input Validation   | Yes     | `validateMove()` is the server-side authority; all `game:move` payloads validated before state mutation      |
| V6 Cryptography       | No      | Only coin flip + referee card use randomness; `crypto.randomInt` is the correct primitive (STATE.md pitfall) |

### Known Threat Patterns for This Stack

| Pattern                                                                   | STRIDE                 | Standard Mitigation                                                                                |
| ------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| Opponent emitting `game:move` for your pieces                             | Spoofing               | Validate `socket.data.playerSlot` maps to the currently active team before processing              |
| Double-click race condition                                               | Tampering              | `isProcessing` mutex per Room — already on `Room` type from Phase 3                                |
| Client-supplied piece position (from-coord) trusted without re-validation | Tampering              | Server looks up piece by ID from `state.pieces`; client-supplied `from` coord is not authoritative |
| Invalid `game:end-turn` ending wrong player's slot                        | Elevation of Privilege | Active-player guard in handler; check slot ownership before FSM transition                         |

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection — `packages/shared/src/types.ts`, `moveValidator.ts`, `events.ts`, `hex.ts`, `pitch.ts`, `scoreUtils.ts` — exact current state of all types and validators [VERIFIED: codebase]
- Codebase inspection — `packages/server/src/roomStore.ts`, `roomHandlers.ts`, `createServer.ts` — exact server integration patterns [VERIFIED: codebase]
- `.planning/phases/04-game-engine-phase-fsm/04-CONTEXT.md` — all locked decisions D-01 through D-16 [VERIFIED: planning artifact]
- `.planning/REQUIREMENTS.md` — exact requirement text for TEAM-01 through TEAM-03, PITCH-01 through PITCH-03, MOVE-01 through MOVE-06 [VERIFIED: planning artifact]
- `.planning/STATE.md` — locked architectural decisions, pitfalls [VERIFIED: planning artifact]
- Build and test run verification — clean build, 103 shared + 23 server tests all green [VERIFIED: codebase runtime]

### Secondary (MEDIUM confidence)

- None required — all decisions are locked from context and codebase inspection.

### Tertiary (LOW confidence / ASSUMED)

- A1–A8 in Assumptions Log above.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all dependencies verified in codebase
- Architecture: HIGH — all patterns established in Phase 2/3 codebase
- Pitfalls: HIGH — derived from direct inspection of existing code + locked decisions
- Pitch region data values: LOW — placeholder grid approximation; not from physical board measurements (acknowledged hard block)
- Team attribute values: MEDIUM — valid 1–10 integers for each role; exact values are not rulebook-specified for hardcoded teams

**Research date:** 2026-05-29
**Valid until:** Stable (no external dependencies; all sources are internal to the repo and locked planning artifacts)
