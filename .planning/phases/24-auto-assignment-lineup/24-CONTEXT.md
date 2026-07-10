# Phase 24: Auto-Assignment & Lineup - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers:

1. **Auto-assignment algorithm (server)** — After both players confirm formations (`BOTH_FORMATIONS_CONFIRMED`), the server stat-assigns each team's 11 players to their formation slots using weighted scoring formulas (from Phase 23 deferred section). GK filled first, anchor roles next, flex roles from remaining players.
2. **Assignment broadcast** — Server emits each player's assignment to their socket (home sees home lineup; away sees away lineup). New server event: `LINEUP_ASSIGNMENT_READY` (or similar) per player.
3. **`LineupAssignmentScreen` component (new)** — Dedicated screen displayed after both formations confirmed. Each player sees their own 11 players arranged horizontally in formation columns (GK | DEF | MID | FWD). Full stat cards per player. Drag-to-swap outfield players. Confirm button.
4. **`LINEUP_SWAP` event** — Client emits swap intent (two slot IDs); server validates and broadcasts updated assignment.
5. **`LINEUP_CONFIRM` event** — Client emits confirmed ordering; server stores it. After both players confirm, server calls `buildInitialGameState` with the confirmed player orderings and broadcasts `GAME_STATE`. Game begins.
6. **`buildSquadPieces` update** — Accepts a confirmed ordered player array (one entry per slot index) instead of raw `getSquadPlayers` call; maps player → slot by position in that array.

**Phase 23 dependency:** `FORMATIONS` table, `FormationId`, `SlotRole`, `FormationSlot`, `buildSquadPieces` function, `BOTH_FORMATIONS_CONFIRMED` event — all delivered by Phase 23 and used here.

**Phase 23 code restructuring required:** The current `roomHandlers.ts` UNIFORM_CONFIRM handler calls `buildInitialGameState` immediately when both players confirm. Phase 24 must remove this call and insert the auto-assignment + lineup confirmation step before `buildInitialGameState` is invoked. This is a targeted change to the away-confirm branch (~15 lines).

</domain>

<decisions>
## Implementation Decisions

### Auto-Assignment Algorithm (server — ASSIGN-01)

- **D-01:** GK player (role === 'GK') is locked to the GK slot (index 0) first, before any scoring.
- **D-02:** Anchor roles filled next (DEF-center, MID-central, FWD-central) — these map to the "most central" slot in each line. Scored from all remaining non-GK players; highest score wins each anchor slot.
- **D-03:** Flex roles filled last (DEF-back, MID-wing, FWD-wing) — scored from remaining players after anchor slots are filled.
- **D-04:** Scoring formulas per slot role (from Phase 23 deferred):
  - `FWD-central` (ST): `shooting + aerialAbility + (2 if role=FWD) + (4 if role=ST)`
  - `FWD-wing` (RF/LF): `dribbling + highPass + (3 if role=FWD) + (2 if role=MID)`
  - `DEF-center` (RCB/LCB/CB): `tackling + aerialAbility + (2 if role=DEF)`
  - `DEF-back` (RB/LB): `tackling + pace + (2 if role=DEF)`
  - `MID-central` (CM/RCM/LCM): `dribbling + tackling + pace + shooting + (3 if role=MID)`
  - `MID-wing` (RM/LM): `dribbling + highPass + (3 if role=FWD) + (2 if role=MID)`
  - `GK`: assigned directly — no scoring needed (only one GK per squad)
- **D-05:** Tie-breaking — when two players score equally for a slot, prefer the player with the lower source-team index (array order from `getSquadPlayers`). Deterministic; no randomness.
- **D-06:** Assignment result is an ordered array: `PlayerId[]` with 11 entries where `assignment[i]` maps to `FORMATIONS[formationId].slots[i]`. This replaces the current index-based mapping in `buildSquadPieces`.

### Server Flow Restructuring

- **D-07:** Remove `buildInitialGameState` call from the away-confirm branch of the `UNIFORM_CONFIRM` handler in `roomHandlers.ts`. After away confirms, server now: (a) computes auto-assignment for each team; (b) stores `{ homeAssignment: PlayerId[]; awayAssignment: PlayerId[] }` in room state; (c) emits `LINEUP_ASSIGNMENT_READY` to each player's socket (home receives home assignment; away receives away assignment); (d) emits `BOTH_FORMATIONS_CONFIRMED` as before (so existing state updates on client still fire).
- **D-08:** New `LINEUP_SWAP` client event: `{ slotIndexA: number; slotIndexB: number }`. Server validates: (a) slotIndexA and slotIndexB are both outfield (not index 0, the GK slot); (b) game is in lineup-assignment phase; (c) emitter is the correct player slot. If valid, swaps the two entries in the room's stored assignment array and emits `LINEUP_ASSIGNMENT_UPDATED` back to that player with the new ordering.
- **D-09:** GK slot (index 0) is immovable — server rejects any LINEUP_SWAP where either index is 0 (ASSIGN-04). Client should not allow initiating a drag from the GK card.
- **D-10:** New `LINEUP_CONFIRM` client event: `{ confirmedOrder: PlayerId[] }`. Server stores the final confirmed order for that player's team in room state. After both players have confirmed, server calls `buildInitialGameState` with both confirmed orderings and emits `GAME_STATE` broadcast (same as current flow from that point forward).
- **D-11:** `buildSquadPieces` signature change: replaces `getSquadPlayers(selectedTeams.home)` call with an explicit `confirmedHomeOrder: PoolPlayer[]` parameter; the caller resolves player IDs to `PoolPlayer` objects before passing. Same for away. This keeps `buildSquadPieces` pure and testable.
- **D-12:** The `LINEUP_ASSIGNMENT_UPDATED` event is emitted only to the requesting player's socket (not broadcast to both), to preserve lineup privacy.

### LineupAssignmentScreen — Visual Layout

- **D-13:** New standalone component: `packages/client/src/components/LineupAssignmentScreen.tsx` (+ matching `.module.css`). Not an extension of `UniformSelectionScreen`.
- **D-14:** **Horizontal pitch orientation** — matches the actual game board (home attacks left-to-right). Layout columns left-to-right: `GK | DEF | MID | FWD`. Each column contains the slot cards for that line, stacked vertically.
- **D-15:** Each slot card is a **full stat card**: shows all 9 attributes (same stat set as `PlayerStatsPanel`) plus player first name, last name, role (source role from PoolPlayer), and assigned jersey number (from `FormationSlot.jerseyNumber`). Reuse `PlayerStatsPanel` display logic, parameterized for a static `PoolPlayer` rather than a live `PlayerPiece`.
- **D-16:** The screen shows **only the current player's own lineup** — home player sees home cards; away player sees away cards. No opponent lineup visible. This isolates the decision and reduces screen complexity.
- **D-17:** **Bench row** at the bottom of the screen (below the formation columns) — empty in v1.3 but structurally present. Labelled "BENCH" with empty slot placeholders. Designed to accept cards dragged from the pitch (for v1.4 substitutes). No functional behavior in v1.3.
- **D-18:** Heading follows the same "MATCH SETUP: STEP X" pattern as `UniformSelectionScreen`. Step number is one ahead of the formation step (e.g., if formation is step 2, lineup is step 3). Player label and you/opponent convention identical.

### Swap UX (drag-and-drop)

- **D-19:** Swap mechanic: **drag one card over another card to swap**. Uses HTML5 native drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — consistent with desktop-first constraint and no new dependencies.
- **D-20:** Cards are draggable while active (not yet confirmed). The GK card is **not draggable** — visual distinction (no drag cursor; locked appearance) consistent with ASSIGN-04.
- **D-21:** After swapping, the server validates and sends `LINEUP_ASSIGNMENT_UPDATED` with the new order; client updates card positions from the server response (server is authoritative).
- **D-22:** Multiple swaps allowed before confirming.

### Confirmation Gate

- **D-23:** Status messaging mirrors `UniformSelectionScreen` syntax exactly:
  - While active (not yet confirmed): `"Make your selections now!"`
  - After confirming: `"Waiting for [Home/Visitor] Player to Lock in their Selection."`
- **D-24:** After confirming, cards become non-draggable (locked state, visual distinction). Lineup remains visible in read-only form. GK card is always in locked appearance regardless of confirm state.
- **D-25:** The Confirm button is disabled until the player is active (i.e., home confirms first; away is locked until home has confirmed — same ordering as uniform selection, ASSIGN-02's independence is within the parallel window after both can act).
  - Note: ASSIGN-02 says "both players work independently in parallel" — this means after both formations are confirmed, both players receive their assignment simultaneously and can proceed in any order. No sequential lock needed here (unlike uniform selection where home must go first). Both can confirm in any order.
  - **Correction of D-25:** Both players see their lineup simultaneously after `LINEUP_ASSIGNMENT_READY`. Either player can swap and confirm in any order. No home-first gate on LINEUP_CONFIRM.

### Claude's Discretion

- Exact event names (`LINEUP_ASSIGNMENT_READY`, `LINEUP_ASSIGNMENT_UPDATED`) — follow existing `ServerEvents` naming convention in `events.ts`
- CSS layout approach for horizontal formation columns (CSS grid with 4 named column tracks is recommended)
- Card width/height in horizontal layout (recommend fitting all on screen without horizontal scroll if possible, or with minimal horizontal scroll on smaller viewports)
- Whether to create a `LineupStatCard` sub-component or extend `PlayerStatsPanel` via props — extending `PlayerStatsPanel` with an optional `staticPiece?: PoolPlayer` prop is recommended to avoid duplication
- Drag-over visual feedback (card highlight, swap indicator)
- Screen transition name in Zustand store (recommend `'LINEUP_ASSIGNMENT'` screen type)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 23 Deliverables (foundation for Phase 24)

- `packages/shared/src/formations.ts` — `FormationId`, `SlotRole`, `FormationSlot`, `FORMATIONS` registry; slot index 0 is always GK; `slotRole` drives scoring weights (D-04); `jerseyNumber` is the assigned jersey for display
- `.planning/phases/23-formation-system/23-CONTEXT.md` — D-01 through D-16 (hex positions, jersey numbering, event shapes, BOTH_FORMATIONS_CONFIRMED trigger); D-12 states `buildInitialGameState` deferred to Phase 24

### Server Restructuring Targets

- `packages/server/src/roomHandlers.ts` — `UNIFORM_CONFIRM` handler, away-confirm branch (~lines 363–400): remove `buildInitialGameState` call; insert auto-assignment computation + `LINEUP_ASSIGNMENT_READY` emit + `LINEUP_CONFIRM` handler; add `LINEUP_SWAP` handler
- `packages/server/src/roomStore.ts` — Room type: add `homeAssignment: PlayerId[] | null`, `awayAssignment: PlayerId[] | null`, `homeLineupConfirmed: boolean`, `awayLineupConfirmed: boolean`
- `packages/server/src/gameEngine.ts` — `buildSquadPieces` function (~line 115): update signature to accept explicit ordered player arrays instead of calling `getSquadPlayers` internally; `buildInitialGameState` gains corresponding parameters

### Shared Types & Events (extension points)

- `packages/shared/src/events.ts` — Add: `LINEUP_ASSIGNMENT_READY` (ServerToClient), `LINEUP_ASSIGNMENT_UPDATED` (ServerToClient), `LINEUP_SWAP` (ClientToServer), `LINEUP_CONFIRM` (ClientToServer); follow existing typed event generics pattern
- `packages/shared/src/types.ts` — No new `GameState` fields required for v1.3 (assignment is pre-game state; `selectedFormation` already embedded)

### New Client Component

- `packages/client/src/components/UniformSelectionScreen.tsx` — Reference for heading/status/confirm messaging pattern (D-18, D-23); copy "MATCH SETUP" heading and active/waiting status string patterns exactly
- `packages/client/src/components/PlayerStatsPanel.tsx` — Existing stat card component; Phase 24 creates a variant or extends it for static display (D-15) — read before designing `LineupStatCard` to avoid duplication
- `packages/client/src/App.tsx` — Add `LINEUP_ASSIGNMENT_READY` and `LINEUP_ASSIGNMENT_UPDATED` socket handlers; add `'LINEUP_ASSIGNMENT'` screen case in render switch; add `LINEUP_CONFIRM`/`LINEUP_SWAP` emitters

### Requirements

- `.planning/REQUIREMENTS.md` — ASSIGN-01 through ASSIGN-05 (auto-assignment algorithm, display, swap, GK lock, confirm-to-kickoff)

### Scoring Algorithm Context

- `.planning/phases/23-formation-system/23-CONTEXT.md` §Deferred — exact scoring formulas and assignment principle captured here (Phase 23 author: "most skilled player → most central slot; fastest → wing slots")

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`PlayerStatsPanel` component** (`packages/client/src/components/PlayerStatsPanel.tsx`) — Full 9-stat card display with `MiniTokenBadge`. Currently reads from store via `selectedPieceId`. Phase 24 should create a display-only variant that accepts a `PoolPlayer` + slot metadata as props rather than reading from store. Reuse the stat-grid rendering logic.
- **`STAT_LABELS` array** in `PlayerStatsPanel.tsx` — Ordered list of all 9 attributes with display labels; import and reuse in the new stat card variant.
- **`FORMATIONS[formationId].slots`** — Already contains `slotRole`, `jerseyNumber`, `slotId` for each slot; use these as the metadata for each card header.
- **`getSquadPlayers(teamId)`** (`packages/shared/src/teams.ts`) — Returns `PoolPlayer[]` ordered by their source team index. The auto-assignment algo starts from this list on the server.

### Established Patterns

- **Home-first sequential confirm** (`roomHandlers.ts` UNIFORM_CONFIRM) — Phase 24 breaks this pattern: lineup confirm is parallel (both players act independently). Downstream agents should NOT copy the `playerSlot === 1` first-guard for `LINEUP_CONFIRM`.
- **`isProcessing` mutex** (`roomHandlers.ts`) — Apply same mutex to `LINEUP_SWAP` and `LINEUP_CONFIRM` handlers to prevent concurrent modification.
- **Socket emit to specific socket** — `socket.emit(event, data)` (not `io.to(roomCode).emit`) for player-private events like `LINEUP_ASSIGNMENT_READY` and `LINEUP_ASSIGNMENT_UPDATED`. Reference: existing per-player error emits in roomHandlers.
- **Screen transition via `setScreen`** in Zustand store — Used in `App.tsx`; add `'LINEUP_ASSIGNMENT'` to the `Screen` union in `useGameStore` and render `<LineupAssignmentScreen>` in the switch.
- **HTML5 drag-and-drop** — Native browser API; no new library needed. Reference: no existing drag-and-drop in this codebase — implement from scratch using `draggable`, `onDragStart`, `onDragOver`, `onDrop` attributes.

### Integration Points

- `packages/client/src/App.tsx` — register `LINEUP_ASSIGNMENT_READY`/`LINEUP_ASSIGNMENT_UPDATED` handlers in the main `useEffect` socket block (mirroring `BOTH_FORMATIONS_CONFIRMED` handler at line 112); add screen render case for `'LINEUP_ASSIGNMENT'`
- `packages/shared/src/index.ts` — barrel-export new event types and any new shared types added for Phase 24
- `packages/server/src/gameEngine.ts` `buildInitialGameState` — Phase 24 calls this only after both `LINEUP_CONFIRM` events received; caller (roomHandlers) now passes the confirmed ordered player arrays as parameters

</code_context>

<specifics>
## Specific Ideas

### Drag-to-Swap Behaviour (from user)

"Players can drag cards over cards to swap player positions." — Implementation: standard HTML5 drag-and-drop; dragging card A and dropping onto card B triggers a `LINEUP_SWAP` emit to the server. Server swaps, responds with updated assignment, client re-renders. GK card not draggable.

### Bench Row (from user — forward-design for v1.4)

"In the future there will be a bench for substitutes, ensure the design supports players coming off the bench." — Phase 24 renders an empty BENCH row below the formation columns. No functional behavior. The row's DOM structure should be droppable in v1.4 (add `onDragOver`/`onDrop` stubs or a comment marking it as the v1.4 target).

### Horizontal Layout Matches Board Orientation

User explicitly chose "Horizontal pitch — GK at left, FWD at right" because it "matches the actual board orientation (home attacks left→right)." Downstream UI designers should honour this choice — a vertical layout would be incorrect.

### Messaging Verbatim Reference

From `UniformSelectionScreen.tsx`:

- Active state: `'Make your selections now!'`
- Waiting state: `` `Waiting for ${waitingForLabel} Player to Lock in their Selection.` `` (where `waitingForLabel` is `'Home'` or `'Visitor'`)
- Heading: `` `MATCH SETUP: STEP ${step} — ${currentPlayerLabel} PLAYER (${youOrOpponent})` ``

Phase 24's lineup screen uses the same strings. Step number = formation step + 1 (if formation is step 2 in the overall flow, lineup is step 3).

### Player Card Content

Each slot card shows all 9 stats (same as `PlayerStatsPanel`) plus: player first name, last name, source role (e.g., "FWD" from `PoolPlayer.role`), and **assigned jersey number** from the formation slot (not the source team number). This is what appears on the piece during the match (Phase 23 D-14 confirmed: jersey number comes from the slot, not the player's source squad number).

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)

- `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` — Phase 25 (REPLAY-07); not Phase 24 scope
- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — Phase 25 (BUG-23); not Phase 24 scope
- `csv-consolidation-player-pool.md` — Phase 25+; not Phase 24 scope

</deferred>

---

_Phase: 24-auto-assignment-lineup_
_Context gathered: 2026-07-10_
