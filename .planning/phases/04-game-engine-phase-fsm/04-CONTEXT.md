# Phase 4: Game Engine + Phase FSM - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the server-side game engine core: hardcoded teams (11 players each, all 9 attributes), pitch region encoding (final thirds, penalty areas, 6-yard boxes, centre circle, kick-off hex, difficult-angle hexes), a typed FSM that enforces the 4-5-2 movement sequence, the isProcessing mutex wired to every action handler, and an action-log that supports single-turn undo and Phase 8 end-of-game replay. The result is a fully playable Movement Phase: both players can move pieces, the sequence is enforced, MOVE-06 fires correctly, and the server broadcasts valid state after every action.

**Out of scope for Phase 4:**

- Dice rolling and resolution (Phase 5)
- MOVE-07 snapshot-during-movement (Phase 5 — detect condition here, resolve there)
- Client rendering, click handlers, and valid-move highlighting UI (Phase 6–7)
- Match lifecycle (added time, half transitions, full-time detection) (Phase 8)

</domain>

<decisions>
## Implementation Decisions

### FSM Slot Transitions

- **D-01:** Slot advancement uses an explicit `game:end-turn` event — the active player decides when their slot is done. The server does NOT auto-advance when quota is met.
- **D-02:** Movement quotas are always optional. A player may end their turn having moved fewer pieces than their quota allows. Unused moves are forfeited.
- **D-03:** One unified `game:end-turn` event handles all intra-Movement-Phase advances (ATTACKER_4 → DEFENDER_5 → ATTACKER_2). The server reads `movementSlot` to know what to advance.
- **D-04:** After ATTACKER_2 ends (i.e., the third `game:end-turn` within MOVEMENT), the FSM **auto-transitions to PASS phase** — no additional event needed from the client.

### Valid Move Computation

- **D-05:** Valid destination hexes are computed **client-side** using `validateMove()` from `@counter-attack/shared`. No server round-trip on piece selection.
- **D-06:** The server re-validates every `game:move` event. On rejection, it emits a `game:error` event with a typed reason string and re-broadcasts current state so the client snaps back.

### Action Log, Undo, and Replay

- **D-07:** Each move is recorded as an **action delta** appended to `GameState.eventLog`. The delta shape (Claude's discretion): `{ type, pieceId?, from?, to?, slot, timestamp }` where `type` discriminates `MOVE | STEAL_ATTEMPT | SLOT_ADVANCE | DICE_ROLL | etc.`.
- **D-08:** `GameState.eventLog` is typed as `readonly ActionEvent[]` — Phase 4 replaces the existing `readonly unknown[]` placeholder in `packages/shared/src/types.ts`.
- **D-09:** Undo is allowed for all moves within the current slot **until** the first `SLOT_ADVANCE` or `DICE_ROLL` entry in the log. Once either appears, moves in that slot are committed and undo is disabled for that slot.
- **D-10:** The `game:undo` event triggers undo. Server pops the last `MOVE` delta from the log and reverses the piece position.
- **D-11:** The same action log is the source of truth for Phase 8 end-of-game replay — no additional replay-specific data structure needed.

### Match Initialization

- **D-12:** Real GameState (teams, piece positions, coin flip, referee card) is built **immediately when the second player joins** — replacing the stub LOBBY state that Phase 3 created.
- **D-13:** Home/away team assignment uses a **random coin flip** at match start — not slot-based (player 1 ≠ always home).
- **D-14:** After GameState is built, the FSM **auto-advances LOBBY → KICK_OFF** without waiting for a player event. Both players see the pitch fully initialized immediately.

### MOVE-06 / MOVE-07 Scope

- **D-15:** **MOVE-06 IN SCOPE for Phase 4.** After possession switches to a different final third, all pieces in the opposite final third receive a free 6-hex move (attacker moves first). Phase 4's pitch region encoding unblocks this.
- **D-16:** **MOVE-07 DEFERRED to Phase 5.** The moveValidator can detect "ball in penalty area during movement" but SNAPSHOT_AVAILABLE resolution (dice, GK response) belongs in Phase 5 alongside other resolution branches.

### Claude's Discretion

- Delta shape for action log entries: `{ type: ActionEventType, pieceId?: string, from?: HexCoord, to?: HexCoord, slot: MovementSlot | null, timestamp: number }`. Claude should define a proper discriminated union in types.ts.
- Kick-off hex assignment and starting positions for pieces: follow physical board convention (derived from pitch region encoding, not arbitrary).
- Referee card Leniency attribute range: Claude picks a reasonable range (e.g., 1–10 matching other attributes).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Types and Shared Code

- `packages/shared/src/types.ts` — GameState, GamePhase, PlayerPiece, BallState, movementSlot type. Phase 4 extends these (ActionEvent, typed eventLog). Read before touching types.
- `packages/shared/src/moveValidator.ts` — Existing movement validation logic. Phase 4 integrates it into the game engine. JSDoc has deferred notes for MOVE-06/MOVE-07.
- `packages/shared/src/pitch.ts` — Placeholder pitch grid. Phase 4 adds real region encoding alongside this placeholder.
- `packages/shared/src/events.ts` — Typed Socket.io event maps. Phase 4 adds `game:end-turn`, `game:undo`, and `game:error` events here.
- `packages/shared/src/hex.ts` — hexDistance, hexNeighbors, hexesInRange, isUnderZoI — used for pitch region checks.

### Phase 3 Integration Points

- `packages/server/src/roomStore.ts` — Room type with isProcessing mutex, broadcastState helper, GameState field. Phase 4 replaces the stub GameState here.
- `packages/server/src/roomHandlers.ts` — Phase 4 adds `game:end-turn`, `game:move`, `game:undo` handlers alongside existing `room:create` / `room:join`.
- `packages/server/src/createServer.ts` — buildServer factory. Phase 4 handlers registered via registerRoomHandlers pattern.

### Requirements

- `.planning/REQUIREMENTS.md` §Teams & Players — TEAM-01 (hardcoded squads, 9 attributes), TEAM-02, TEAM-03 (referee card)
- `.planning/REQUIREMENTS.md` §Pitch & Grid — PITCH-01, PITCH-02, PITCH-03 (pitch regions, difficult-angle hexes)
- `.planning/REQUIREMENTS.md` §Movement Phase — MOVE-01–MOVE-06 (all in scope); MOVE-07 deferred
- `.planning/ROADMAP.md` §Phase 4 — success criteria 1–5

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/shared/src/moveValidator.ts` — `validateMove()` is the server-side authority. Phase 4 calls it directly in the action handler. Client also calls it for highlighting (D-05).
- `packages/shared/src/hex.ts` — `isUnderZoI()` and `hexesInRange()` are needed for pitch region checks (is hex within final third? within penalty area?).
- `packages/server/src/roomStore.ts` — `broadcastState(io, room)` is the single broadcast entry point. Phase 4 calls it after every validated action (ARCH-04 contract from Phase 3).

### Established Patterns

- **Named exports, no defaults** — All Phase 4 modules follow the PATTERNS.md convention from Phase 3.
- **`.js` extensions on local imports** — NodeNext module resolution (verbatimModuleSyntax: true).
- **Discriminated union results** — `validateMove()` returns `MoveResult`. Phase 4 FSM actions should follow the same pattern.
- **guard-first early returns** — Established in moveValidator.ts and roomStore.ts; apply to all FSM action handlers.
- **isProcessing mutex pattern** — `room.isProcessing` is set true at handler entry, false in finally. Already on Room type from Phase 3.

### Integration Points

- New FSM handler file (e.g., `packages/server/src/gameHandlers.ts`) registered via `registerGameHandlers(io, socket)` called from the connection handler in createServer.ts — mirrors the `registerRoomHandlers` pattern.
- `packages/shared/src/types.ts` — `eventLog: readonly unknown[]` needs replacing with `readonly ActionEvent[]`. Update here, not in a separate types file.
- `packages/shared/src/events.ts` — Add `GAME_END_TURN`, `GAME_UNDO`, `GAME_ERROR` to ClientEvents/ServerEvents. `ClientToServerEvents` and `ServerToClientEvents` maps need new entries.

</code_context>

<specifics>
## Specific Ideas

- Undo boundary rule (from discussion): undo is allowed per-slot, and is disabled once the first `SLOT_ADVANCE` or `DICE_ROLL` delta appears in the log for that slot. This means a player can freely undo moves during ATTACKER_4, but once they send `game:end-turn` (producing a SLOT_ADVANCE), ATTACKER_4 moves are committed.
- MOVE-06 requires pitch region encoding first — design pitch region data before implementing the free-move logic.
- Stub dice for Phase 4: where the game engine needs dice (steal attempt), use a deterministic stub (e.g., always return a fixed result or a seeded value) so Phase 4 can complete without Phase 5's crypto dice. Phase 5 replaces the stub.

</specifics>

<deferred>
## Deferred Ideas

- **MOVE-07 (snapshot during movement)**: detected in Phase 4 (SNAPSHOT_AVAILABLE effect from moveValidator), resolved in Phase 5 alongside other dice branches.
- **Real board measurements for pitch.ts**: exact axial (q, r) coordinates for the physical Counter Attack board remain a HARD BLOCK until user provides photo/measurements. Phase 4 encodes pitch _regions_ using the placeholder grid — this is sufficient for region checks but not pixel-accurate rendering (Phase 6 concern).

None — discussion stayed within phase scope otherwise.

</deferred>

---

_Phase: 4-game-engine-phase-fsm_
_Context gathered: 2026-05-29_
