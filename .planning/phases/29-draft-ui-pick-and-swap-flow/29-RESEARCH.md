# Phase 29: Draft UI + Pick-and-Swap Flow - Research

**Researched:** 2026-07-21
**Domain:** Real-time WebSocket turn-sequencing UI (Socket.io + React/Zustand), drag-and-drop card carousel, server-authoritative session state machine
**Confidence:** HIGH (this phase extends 4 well-established same-repo patterns — no new library, no new architecture)

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pack-Swap Protocol (DRAFT-07):**

- D-01: Each cycle = pick 1 (6 remain) → swap remainder packs with partner → pick 2 (4 remain) → swap remainder packs back → pick 1 more (3 remain, discarded) → each player opens a brand-new pack from the pre-generated 8-pack batch. 1+2+1=4 cards/cycle × 4 cycles = 16 cards/player. Matches `PACKS_PER_MATCH = 8` (2 players × 4 cycles × 1 new pack each = 8).
- D-02: The 3 leftover cards after the third pick are discarded — never enter play, no shared pool.
- D-03: No manual "ready" button. Dragging a card off the current pack is itself the readiness signal. Server waits for both players' picks before advancing to the next sub-step/cycle (mutual-wait gate, same pattern as `LINEUP_CONFIRM`'s home/away flags) — but readiness is implicit in the pick action.
- D-04: The 8 packs are pre-generated once (Phase 28's `generateDraftPacks`/`draftPacks.ts` at settings-confirm time) and then **randomly assigned to players** — not a fixed `packs[0-3]→home` convention. Within a player's own 4 assigned packs, they open in a fixed/sequential order across the 4 cycles.

**Combined Draft + Lineup + Bench Interaction (DRAFT-06, DRAFT-09):**

- D-05 (major departure from a literal separate-screen reading): The draft-pack carousel renders directly over/above the lineup screen (same screen as `LineupAssignmentScreen`, not a separate step). Dragging a card from the draft-pack carousel onto a lineup slot or onto the bench is the pick action — it simultaneously drafts the card and places it. No intermediate "drafted but unplaced" state.
- D-06: Cards can only move **out of** the draft-pack row (row → lineup, row → bench). Cards can never be dragged back into the draft-pack row once picked.
- D-07: Dragging a card onto an already-occupied lineup slot replaces the occupant, and the replaced player moves to the bench (not discarded, not lost).
- D-08: Once drafted, cards move freely between lineup and bench (both directions) for the rest of the draft process — same drag-and-drop swap pattern `LineupAssignmentScreen` already has for Standard mode.
- D-09: Slot-role restriction: only a GK card can be dropped on the GK slot (and only the GK slot accepts a GK card). Every other slot accepts any drafted player regardless of role.
- D-10: Pack-swap cycle gating (D-01/D-03) is fully independent of lineup/bench rearrangement. Only dragging a card off the draft-pack row counts as "the pick" and advances cycle state; freely rearranging already-drafted cards between lineup and bench afterward has no effect on cycle progression.
- D-11: Formation, team (colors/name — cosmetic only in draft mode), and jersey style are all selected in the screens before this one (existing Phase 22/23 flow). This phase starts with an already-visible empty formation shell (role-labeled empty slots) to drag cards onto.
- D-12: While waiting on the opponent's pick, the player who already picked sees a "waiting for opponent" indicator and their draft-pack row is disabled/non-interactive until the opponent also picks. Lineup/bench rearrangement of already-drafted cards is presumably still allowed while waiting (Claude's discretion, leaning enabled).
- D-13: Mid-draft disconnect/reconnect within the existing 90s grace window resumes exactly where the draft left off (current pack contents, already-drafted lineup/bench state re-sent) — same reconnect behavior as an in-progress match.
- D-14: New draft socket events follow the existing `LINEUP_SWAP`/`LINEUP_ASSIGNMENT_UPDATED` convention: a client-emitted pick event, and a per-socket (unicast, not broadcast) private state update in response — keeps each player's current pack contents private from the opponent, same as lineup privacy today.

**Post-Draft Behavior (DRAFT-10):**

- D-15 (overrides a literal "auto-position" reading): After the last pick (including 4th-cycle keeper-safety resolution), there is **no automatic repositioning** — whatever the player manually arranged during the draft stands as-is. Only jersey **numbering** is automatic: starters get their role-appropriate numbers (existing Standard-mode numbering convention via `slotMeta.jerseyNumber`), bench players get a **random unused number in the 15-99 range** (not sequential).
- D-16 (⚠ REQUIREMENTS.md conflict, confirmed intentional): REQUIREMENTS.md's DRAFT-10 text says bench overflow gets "sequential numbers." User explicitly confirmed random 15-99 is correct and overrides that text. REQUIREMENTS.md needs a wording update (during this phase's planning or as a follow-up).

**Keeper Safety (DRAFT-08):**

- No new decisions beyond REQUIREMENTS.md/ROADMAP.md: on cycle 4, if a player hasn't drafted a keeper by their first pick of that cycle, a keeper is auto-selected as their second pick (pack passed has one fewer card; next pick phase for that player is 1 card instead of 2). Auto-selected keeper still goes through drag-to-place, OR is auto-placed on the GK slot directly — **Claude's discretion**, resolved: auto-place into the empty GK slot if unfilled, otherwise onto the bench.

**Card Visual Design:**

- D-17: Tier→color mapping: Chase = gold (`#f5c518`), Rare = silver (`#c0c0c0`), Uncommon = bronze (`#cd7f32`), Common = blue (`#3b82f6`), Keeper = green (`#22c55e`).
- D-18: Card content unchanged from `LineupStatCard`'s existing fields — only new element is a rarity indicator.
- D-19: Rarity indicator is a **colored border/frame** (`3px solid {tier color}`) around the whole card, not a corner badge or icon.
- D-20: Draft-pack row is a **standard left-right navigable carousel** (not all-cards-at-once) — rarest cards sort to the left, view starts scrolled left on each new pack. Must generically handle variable pack sizes (6-card pack on keeper-safety pick in cycle 4), not hardcoded to 7.
- D-21: Bench uses the identical carousel card style as the draft-pack row, positioned below the main lineup grid.
- D-22: Empty (unfilled) lineup slots during the draft reuse the existing `LineupAssignmentScreen` empty-slot placeholder style — no new empty-state component.
- D-23: The draft-pack carousel row disappears entirely once the draft completes (all 16 picks resolved) — leaving just the finalized lineup + bench, which proceeds into the existing lineup-confirm flow.

### Claude's Discretion

- Whether lineup/bench rearrangement is allowed while waiting on the opponent's pick (D-12) — reasonable to leave enabled since it doesn't touch cycle state (per D-10).
- Whether the 4th-cycle auto-selected keeper (DRAFT-08) is auto-placed directly into the GK slot or dropped onto the bench — resolved: auto-place into empty GK slot if unfilled, otherwise bench (per UI-SPEC Component Note 5).
- Exact module/component layout for the new draft-pack carousel component (new file vs. extending `LineupAssignmentScreen.tsx`) — follow existing component conventions.
- Exact new Socket.io event names (e.g. `DRAFT_PICK`, `DRAFT_STATE_UPDATED`) — follow `packages/shared/src/events.ts`'s existing naming conventions (verb-noun, past-tense for server→client).

### Deferred Ideas (OUT OF SCOPE)

- Full auto-position-by-stat-weight for Draft mode (the literal DRAFT-10 reading) — explicitly not wanted; manual draft-time placement stands (D-15). Not deferred to a future phase, just decided against.
- REQUIREMENTS.md DRAFT-10 wording update (sequential → random 15-99) — should happen alongside or shortly after this phase ships (D-16); not a blocking dependency for planning/execution.
- Reviewed pending todos (GK_KICK replay visibility, KICK_OFF_SETUP shading, header-winner eligibility, CSV consolidation) — all scored low relevance, not folded into this phase.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                                                     | Research Support                                                                                                                                                                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DRAFT-06 | Draft screen appears between team/formation selection and lineup; displays a carousel of 7 cards above the lineup grid                          | Confirmed as an overlay on the existing `LineupAssignmentScreen` (not a separate screen, per D-05). See Architecture Patterns §1-2 and Code Examples §Draft-Pack Carousel Component.                                                                                                                             |
| DRAFT-07 | Pick-and-swap draft flow per cycle: pick 1 → swap packs; pick 2 → swap packs; pick 1 → open new pack; repeat ×4 (16 cards/player)               | Server-side cycle state machine designed in Architecture Patterns §3; verified against `PACKS_PER_MATCH=8`/`PACK_COMPOSITION` in `draftEngine.ts`/`types.ts`. See Common Pitfalls §1 (mutual-wait gate granularity) — flagged as an open question needing a planning decision.                                   |
| DRAFT-08 | On 4th cycle, auto-keeper-safety pick if player hasn't drafted a keeper yet; pack has one fewer card; next pick phase is 1 card instead of 2    | Mechanic requires the "1 keeper per pack, every pack" invariant (verified in Package/Data section) — see Architecture Patterns §4 for the recommended trigger point and Common Pitfalls §2.                                                                                                                      |
| DRAFT-09 | Bench dynamically sized to hold all drafted cards not in the starting 11; bench uses the same card-carousel display as the draft stage          | See Architecture Patterns §5 (dynamic bench sizing, up to 16 cards) and Code Examples §Bench Carousel.                                                                                                                                                                                                           |
| DRAFT-10 | After draft, lineup auto-positions/auto-numbers players by total stat; team badge/colors applied to all cards; overflow gets sequential numbers | **Superseded per D-15/D-16**: no auto-repositioning; only numbering is automatic (starters via existing `slotMeta.jerseyNumber`, bench via random 15-99, NOT sequential). Team badge/colors already automatic via existing `teamId={myTeamId}` prop threading — zero new work required (see Don't Hand-Roll §1). |

</phase_requirements>

## Summary

Phase 28 already built and verified the entire draft **data model**: `generateDraftPacks(selectedPools, rng)` in `packages/shared/src/draftEngine.ts` produces exactly `PACKS_PER_MATCH = 8` packs of 7 cards each (`PACK_COMPOSITION`: 1 chase, 1 rare, 1 uncommon, 3 common, 1 keeper), server-bound via `generateMatchPacks` in `packages/server/src/draftPacks.ts` (uses `crypto.randomInt`, never `Math.random`). **This is not yet wired into any socket handler** — `ROOM_SETTINGS_CONFIRM` currently only stores `teamType`/`draftPools` on the room. Phase 29's core job is threading that engine output through a brand-new server-side session state machine (cycle/sub-step tracking, per-player current-pack contents, drafted/bench sets) and exposing it through a new drag-and-drop UI layer on top of the **existing** `LineupAssignmentScreen.tsx`.

Critically, this phase is a UI/orchestration phase, not a new-architecture phase: every mechanism it needs already has a same-repo precedent. Drag-and-drop swap logic, GK-slot locking, mutual-wait gating (`LINEUP_CONFIRM`'s home/away flags), per-socket-private state delivery (`LINEUP_ASSIGNMENT_UPDATED`), and the dark-theme stat-card visual language all exist verbatim in `LineupAssignmentScreen.tsx` + `.module.css` and `roomHandlers.ts`. The one genuinely new UI primitive is a left-right navigable carousel (D-20/D-21) — nothing like it exists yet in the client, but it is a straightforward wrapper around the existing `LineupStatCard` shape.

The largest true design gap this research surfaces is that the current `UNIFORM_CONFIRM` away-branch **unconditionally** calls `computeAutoAssignment(getSquadPlayers(...))` and emits `LINEUP_ASSIGNMENT_READY` with a fully-populated 11-entry assignment — this is correct for Standard mode but must NOT run for Draft mode (there is no squad to auto-assign from; the formation shell must start empty). This branch point is exactly where Draft-mode divergence must be inserted, and it's also the natural point to call `generateMatchPacks` + randomly assign packs to players (matching the forward-pointer comment already left in `draftPacks.ts`).

**Primary recommendation:** Extend `LineupAssignmentScreen.tsx` (do not fork it) with a `draftMode` prop; add a server-side `DraftSession` sub-object on `Room` (cycle, sub-step, per-player pack, drafted ids, bench ids); gate the existing `UNIFORM_CONFIRM` away-branch on `room.teamType === 'draft'` to skip `computeAutoAssignment` and instead call `generateMatchPacks` + emit an empty assignment; add exactly two new socket events (`DRAFT_PICK` client→server, `DRAFT_STATE_UPDATED` server→client unicast) following the `LINEUP_SWAP`/`LINEUP_ASSIGNMENT_UPDATED` naming and privacy pattern.

## Architectural Responsibility Map

| Capability                                       | Primary Tier     | Secondary Tier             | Rationale                                                                                                                                                          |
| ------------------------------------------------ | ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pack generation (`generateMatchPacks`)           | API / Backend    | —                          | Gameplay-affecting randomness; must be server-authoritative, already built in Phase 28, only needs wiring                                                          |
| Pack→player random assignment (D-04)             | API / Backend    | —                          | Fairness-critical randomness; `crypto.randomInt`-based, server-only, mirrors dice/backfill convention                                                              |
| Draft cycle/sub-step state machine               | API / Backend    | —                          | Mutual-wait gating requires a single source of truth shared by both clients; same reasoning as `homeLineupConfirmed`/`awayLineupConfirmed`                         |
| Per-player current-pack contents                 | API / Backend    | —                          | Must stay private per player (D-14) — server decides who can see what, unicast delivery                                                                            |
| Draft-pack carousel rendering                    | Browser / Client | —                          | Pure display + drag source; no business logic, mirrors existing `LineupStatCard` rendering                                                                         |
| Drag-and-drop pick/place interaction             | Browser / Client | API / Backend (validation) | Client captures the drag gesture and emits an event; server validates and is the source of truth for the resulting state (ARCH-04 full-snapshot broadcast pattern) |
| Keeper-safety auto-pick trigger                  | API / Backend    | —                          | Must be deterministic and server-driven so both clients see identical outcomes; client only renders the resulting banner                                           |
| Bench dynamic sizing/display                     | Browser / Client | —                          | Pure layout concern once server sends the bench id list                                                                                                            |
| Post-draft jersey numbering (bench random 15-99) | API / Backend    | —                          | Requires a single canonical random value; server assigns once, sends to client for display only                                                                    |
| Team badge/colors on drafted cards               | Browser / Client | —                          | Already solved — existing `teamId={myTeamId}` prop on `LineupStatCard` requires zero new code                                                                      |

## Standard Stack

This phase introduces **no new external dependencies**. It is built entirely from packages already installed and libraries already in use project-wide (Socket.io, React, Zustand, native HTML5 drag-and-drop, CSS Modules). No `npm install` is required.

### Core (existing, reused)

| Library                                                               | Version                | Purpose                            | Why Standard (this repo)                                                                                                                                 |
| --------------------------------------------------------------------- | ---------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| socket.io / socket.io-client                                          | 4.x (installed)        | Real-time pick/swap event delivery | Already the sole transport for every prior phase's turn-based flow                                                                                       |
| React + Zustand                                                       | 18.x / 4.x (installed) | UI rendering / global game state   | Established project-wide pattern; drag state must stay in local `useState`, not Zustand (existing Pitfall 7 convention)                                  |
| HTML5 native drag-and-drop (`draggable`, `onDragStart/Over/Drop/End`) | browser-native         | Card pick/place gestures           | `LineupAssignmentScreen.tsx` already implements this pattern verbatim (lines 202-232) — reuse, do not introduce a DnD library (react-dnd, dnd-kit, etc.) |
| CSS Modules                                                           | (Vite built-in)        | Component styling                  | Zero component library / Tailwind / shadcn anywhere in this codebase (confirmed in UI-SPEC); do not introduce one                                        |

### Supporting

| Library                            | Version | Purpose                                                                     | When to Use                                                                                  |
| ---------------------------------- | ------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `crypto.randomInt` (Node built-in) | n/a     | Pack→player random assignment (D-04), bench random-number assignment (D-15) | Server-side only, never `Math.random()` — matches `draftPacks.ts`/`gameEngine.ts` convention |

### Alternatives Considered

| Instead of                       | Could Use                                                | Tradeoff                                                                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native HTML5 drag-and-drop       | `react-dnd`, `@dnd-kit/core`                             | Would introduce the project's first drag library; unnecessary — existing native implementation already handles slot-to-slot swap, replace-and-bench, and can be extended for row-to-slot/row-to-bench with the same event handlers |
| Server-authoritative cycle state | Client-computed cycle state with periodic reconciliation | Violates ARCH-04 (server-authoritative full-state broadcast, no client-side derived game logic) and D-14 (server decides pack privacy)                                                                                             |

**Installation:** None required — no new packages.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. Skipping the standard audit table per the protocol's scope (only required "whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT (packages/client)                                            │
│                                                                       │
│  App.tsx (routing)                                                   │
│    │ screen === 'LINEUP_ASSIGNMENT' && teamType === 'draft'          │
│    ▼                                                                  │
│  LineupAssignmentScreen.tsx (extended, draftMode=true)               │
│    ├─ DraftPackCarousel (new)         ─┐                             │
│    │    left-right nav, tier-sorted    │  drag source only            │
│    │    reused LineupStatCard + border │  (D-06: one-way out)         │
│    ├─ Formation grid (existing)       ◄┘  drop target (slot/bench)   │
│    │    GK-slot-lock extended for      ▲                             │
│    │    reverse case (GK-out-of-slot)  │                             │
│    └─ BenchCarousel (new, dynamic)  ◄──┘  drop target + drag source   │
│         same card style as draft row      (existing bench↔lineup DnD) │
│                                                                       │
│  onDrop(row→slot/bench)  ──emit──▶  DRAFT_PICK { cardId, dest }      │
│  onDrop(slot↔bench)      ──emit──▶  LINEUP_SWAP (existing, reused)   │
│                                                                       │
│  socket.on(DRAFT_STATE_UPDATED) ◄── unicast, private per player      │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ Socket.io (WebSocket only)
┌───────────────────────────────▼───────────────────────────────────────┐
│ SERVER (packages/server)                                              │
│                                                                       │
│  roomHandlers.ts                                                      │
│    ROOM_SETTINGS_CONFIRM  ── teamType==='draft' ──▶ generateMatchPacks│
│                                                       + random pack    │
│                                                       assignment (D-04)│
│                                                       stored on Room   │
│                                                                       │
│    UNIFORM_CONFIRM (away-branch)                                      │
│      ├─ teamType==='standard' → computeAutoAssignment (existing)      │
│      └─ teamType==='draft'    → empty assignment array + emit         │
│                                   initial DRAFT_STATE_UPDATED          │
│                                   (first pack contents, 0 drafted)     │
│                                                                       │
│    DRAFT_PICK (new)                                                   │
│      ├─ validate: card in current pack, dest is valid slot/bench      │
│      ├─ validate: GK-only-on-GK-slot, occupant→bench on replace        │
│      ├─ mark this player's pick done for the current sub-step         │
│      ├─ if both players done → advance sub-step (swap/new-pack/cycle) │
│      ├─ cycle 4: keeper-safety check after PICK1 resolves              │
│      └─ emit DRAFT_STATE_UPDATED to each socket individually (private) │
│                                                                       │
│    draft complete (16/16 picked both sides)                           │
│      ├─ assign bench random 15-99 numbers (crypto.randomInt)          │
│      ├─ emit final DRAFT_STATE_UPDATED (draftComplete: true)          │
│      └─ client hides draft row (D-23), existing Confirm/LINEUP_CONFIRM│
│           flow takes over unchanged                                   │
│                                                                       │
│  roomStore.ts (Room type extended — see Code Examples)                │
└───────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
packages/shared/src/
├── events.ts                       # + DRAFT_PICK, DRAFT_STATE_UPDATED (new)
├── types.ts                        # + DraftSessionState / DraftPickPayload types (new, shared client+server)

packages/server/src/
├── roomHandlers.ts                 # + DRAFT_PICK handler; UNIFORM_CONFIRM away-branch gated on teamType
├── roomStore.ts                    # Room type + draftSession?: DraftSessionState field
├── draftPacks.ts                   # UNCHANGED — generateMatchPacks already exists, just call it
└── draftSession.ts                 # NEW — pure state-transition helpers (advance sub-step, keeper-safety
                                     #   check, bench numbering) kept out of roomHandlers.ts for testability,
                                     #   mirrors gameEngine.ts's separation from roomHandlers.ts

packages/client/src/components/
├── LineupAssignmentScreen.tsx      # extended: draftMode prop, renders DraftPackCarousel + wires DRAFT_PICK
├── LineupAssignmentScreen.module.css  # + tier border classes, carousel row styles
├── DraftPackCarousel.tsx           # NEW — generic-over-pack-size left-right carousel
├── BenchCarousel.tsx               # NEW (or inline in LineupAssignmentScreen) — dynamic-length carousel,
                                     #   same card visual as DraftPackCarousel
```

### Pattern 1: Server-authoritative mutual-wait gate (reuse verbatim)

**What:** Track a boolean/flag per player for "has this player completed their action for the current sub-step"; only advance shared state when both flags are true.
**When to use:** Every DRAFT_PICK sub-step transition (PICK1→SWAP, PICK2→SWAP_BACK, PICK3→NEW_PACK/cycle-advance).
**Example:**

```typescript
// Source: packages/server/src/roomHandlers.ts LINEUP_CONFIRM handler (existing, verbatim pattern)
if (playerSlot === 1) {
  room.homeLineupConfirmed = true;
} else {
  room.awayLineupConfirmed = true;
}
if (!room.homeLineupConfirmed || !room.awayLineupConfirmed) {
  return; // still waiting for the other player
}
// Both confirmed — advance shared state, reset flags for next sub-step.
```

Apply identically for draft sub-steps: `room.draftSession.homePickedThisSubStep` / `awayPickedThisSubStep`, reset to `false` immediately after both-true advance fires.

### Pattern 2: Per-socket private state delivery (reuse verbatim)

**What:** Never `io.to(roomCode).emit(...)` for player-private data — always look up the individual socket and `.emit()` to it directly.
**When to use:** Every `DRAFT_STATE_UPDATED` emission (each player's current pack contents must stay private, D-14).
**Example:**

```typescript
// Source: packages/server/src/roomHandlers.ts LINEUP_SWAP handler (existing, verbatim pattern)
socket.emit(ServerEvents.LINEUP_ASSIGNMENT_UPDATED, assignment); // requester only
// For draft: server must emit to BOTH sockets after a resolved sub-step (both players'
// pack contents changed), but each gets ONLY their own private payload:
const homeSocket = io.sockets.sockets.get(room.players[0]!.socketId);
const awaySocket = io.sockets.sockets.get(room.players[1]!.socketId);
homeSocket?.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room, 'home'));
awaySocket?.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room, 'away'));
```

### Pattern 3: Draft cycle sub-step state machine (NEW, recommended design)

**What:** A small enum-driven state machine per room, verified against Phase 28's constants.
**Recommended sub-step sequence per cycle** (derived from D-01, cross-checked against `PACKS_PER_MATCH=8`):

```
PICK1        (own newly-opened pack, 7→6 cards)   — mutual-wait gate
  ↓ (auto, both done)
SWAP         (server exchanges "current pack" reference between the two players — no user action)
  ↓
PICK2        (partner's swapped pack, 6→4 cards, TWO individual card picks) — mutual-wait gate
  ↓ (auto, both done picking BOTH of their 2 cards)
SWAP_BACK    (server exchanges packs back to original owner — no user action)
  ↓
PICK3        (own pack again, 4→3 cards, 3 discarded) — mutual-wait gate
  ↓ (auto, both done)
NEW_PACK     (each player opens their next pre-assigned pack) → cycle++, back to PICK1
             (after cycle 4's NEW_PACK step, instead: draftComplete = true)
```

**Cross-check:** 4 cycles × (1+2+1) = 16 cards/player. ✓ matches `PACKS_PER_MATCH=8` (2 players × 4 packs each). Verified live against `packages/shared/src/draftEngine.ts` (399 lines, `generateDraftPacks` fully implemented and tested in Phase 28) — no drift from the constant assumed in CONTEXT.md.

### Pattern 4: Keeper-safety trigger point (DRAFT-08)

**What:** After both players complete PICK1 of **cycle 4 only**, before the PICK1→SWAP transition, check each player independently: has this player drafted ANY keeper-tier card in cycles 1-3 (or PICK1 of cycle 4)? If not, auto-remove the keeper-tier card from that player's currently-visible pack (their own cycle-4 pack, since PICK1 always draws from the player's own pack) and add it directly to their drafted set, counting as their "second pick" — their subsequent PICK2 sub-step then requires only 1 manual card, not 2.
**Why this works:** Verified invariant from Phase 28 — `PACK_COMPOSITION.keeper = 1` for every one of the 8 generated packs (not just some), so every pack a player ever opens (cycles 1-4) is guaranteed to contain exactly one keeper card. If a player skipped it every time, cycle 4's own pack is guaranteed to still have that cycle's keeper available to auto-select.
**Auto-placement (UI-SPEC Component Note 5):** place the auto-selected keeper directly into the GK slot if still empty; otherwise onto the bench. Do not require drag-to-place for the auto-selected card.

### Pattern 5: Dynamic bench sizing (DRAFT-09)

**What:** Bench must render anywhere from 0 to 16 cards (not a fixed 5) — a player can choose to bench nearly everything before filling lineup slots, since D-06/D-08 place no ordering constraint between drafting and lineup-filling.
**Existing structural placeholder to replace:** `LineupAssignmentScreen.tsx` lines 283-291 (`.benchPlaceholders` mapping a fixed `[0,1,2,3,4]`) — this is explicitly called out in CONTEXT.md as "structural-only in v1.3" and is what this phase wires real data into.
**Recommended approach:** Render `benchCardIds.map(...)` directly (no fixed-length array), reusing the same carousel/card component as the draft-pack row (D-21) but without the one-way-out restriction (D-08 allows bench↔lineup both directions).

### Anti-Patterns to Avoid

- **Computing auto-assignment for Draft mode:** The existing `UNIFORM_CONFIRM` away-branch unconditionally calls `computeAutoAssignment(getSquadPlayers(...))`. This MUST be gated on `room.teamType !== 'draft'` — there is no squad in draft mode, and D-15 explicitly forbids any auto-positioning of drafted players.
- **Client-side pick validation as source of truth:** Following ARCH-04, the client only sends `DRAFT_PICK`; the server is the sole authority on whether the pick is legal (card present in current pack, correct GK-slot rule) and the sole author of the resulting state. Never trust a client-echoed pack/lineup state.
- **Forking `LineupAssignmentScreen.tsx` into a separate `DraftScreen.tsx`:** Per D-05, this is explicitly the SAME screen with an additional carousel row, not a new screen component — forking would duplicate the drag-and-drop logic and the formation-column rendering.
- **Broadcasting draft pack contents room-wide:** `io.to(roomCode).emit(...)` would leak each player's pack contents to their opponent, violating D-14/fairness. Always resolve individual sockets and `.emit()` per-player.
- **Introducing a drag-and-drop library:** No DnD library exists in this codebase; native `draggable`/`onDrag*` handlers are the established, sufficient pattern for ~600 hex board pieces and now for a max-16-card carousel — performance is a non-issue at this scale.

## Don't Hand-Roll

| Problem                                                    | Don't Build                                                        | Use Instead                                                                                                                                          | Why                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team badge / color application on drafted cards (DRAFT-10) | A new "apply team colors to pooled players" step                   | Existing `teamId={myTeamId}` prop already threaded through `LineupStatCard` (line 250 of `LineupAssignmentScreen.tsx`)                               | The card component already renders whatever `teamId` it's given — since the player's own confirmed team (`myConfirmedTeamId` in `App.tsx`) is passed regardless of the underlying player's `sourceTeamId`, every drafted card already gets the correct cosmetic team badge/colors with zero new code |
| Starter jersey numbering (DRAFT-10)                        | A "compute jersey number from stat rank" function for lineup slots | Existing `slotMeta.jerseyNumber` (from `FormationSlot`, e.g. GK=1, ST=9) already rendered by `LineupStatCard` (`#{slotMeta.jerseyNumber}`, line 117) | Numbers are a static property of the formation slot, not the player — this already works correctly for any player placed in a slot, draft or standard                                                                                                                                                |
| Pack shuffle / rarity-tier classification                  | Any new tier-percentile or shuffle logic                           | `packages/shared/src/draftEngine.ts` (`generateDraftPacks`, `assignTiers`) — fully built and verified in Phase 28                                    | Re-deriving this would duplicate a tested, threat-modeled (T-28-04-FAIR) implementation                                                                                                                                                                                                              |
| Random pack-to-player assignment / bench numbering         | `Math.random()` anywhere                                           | `crypto.randomInt` (bound the same way `draftPacks.ts` binds it into `generateMatchPacks`)                                                           | Project-wide convention: any gameplay-or-fairness-affecting randomness must be server-side CSPRNG, never client-side or `Math.random`                                                                                                                                                                |

**Key insight:** This phase has almost nothing to hand-roll from scratch in the data/logic layer — Phase 28 already solved pack generation and tiering. The only genuinely new "build" is the carousel UI component and the cycle/sub-step state machine; everything else is either direct reuse or a small structural extension of `LineupAssignmentScreen.tsx`.

## Common Pitfalls

### Pitfall 1: Ambiguous mutual-wait granularity for the "pick 2" sub-step

**What goes wrong:** CONTEXT.md's D-01/D-03 describe "pick 2 cards" as one phase, but D-03 also says the game waits for both players' picks "before advancing to the next sub-step" — it does not fully specify whether each of the 2 individual card picks is its own mutual-wait gate, or whether a player can freely make both picks back-to-back and only the phase-boundary (before SWAP_BACK) is gated.
**Why it happens:** The UI-SPEC's copy contract (`Cycle {n} of 4 · Pick {k} of {2 or 1}`) implies a visible sub-counter but doesn't resolve whether the counter blocks on the opponent between k=1 and k=2.
**How to avoid:** Research recommends the **phase-boundary-only gating** interpretation (Architecture Patterns §3): a player may make both of their PICK2 cards freely and independently (no cross-player dependency exists until the SWAP_BACK needs both players' final pack states); the mutual-wait gate applies only at the 3 phase boundaries (PICK1→SWAP, PICK2(both cards)→SWAP_BACK, PICK3→NEW_PACK). This is simpler to implement and matches the "sub-step" wording more literally than a per-card gate would. **Flag this as an assumption requiring plan-time confirmation** — see Assumptions Log A1.
**Warning signs:** If implemented as a per-card gate instead, the "waiting for opponent" indicator would flicker on/off mid-phase in a way not described anywhere in CONTEXT.md/UI-SPEC — a sign the wrong interpretation was chosen.

### Pitfall 2: Draft-mode UNIFORM_CONFIRM regression

**What goes wrong:** If the `UNIFORM_CONFIRM` away-branch is left unmodified, Draft-mode rooms will call `getSquadPlayers(teamId)` (a Standard-mode team roster) and `computeAutoAssignment`, producing a full 11-player lineup from the WRONG player pool (a real team's squad, not the drafted-pool cards) before the draft even starts.
**Why it happens:** This code path is shared by both team types today (draft mode was stubbed through it in Phase 27/28 without a Draft-specific branch, since Phase 28 was scoped to data-model only).
**How to avoid:** Add an explicit `if (room.teamType === 'draft') { ... } else { /* existing computeAutoAssignment path */ }` branch at the exact point identified in `roomHandlers.ts` (the away-branch of `UNIFORM_CONFIRM`, ~lines 516-527).
**Warning signs:** A verification/manual test would show real team-squad players (not drafted-pool cards) pre-filled into lineup slots at draft-screen load.

### Pitfall 3: Reconnect does not currently resend pre-gameState phase data

**What goes wrong:** D-13 requires mid-draft disconnect/reconnect to resume exactly where the draft left off. The **existing** reconnect handler in `createServer.ts` (lines 91-150) only re-emits `GAME_STATE` (`if (room.gameState !== null)`) — it does NOT resend `ROOM_SETTINGS_CONFIRMED`, `BOTH_FORMATIONS_CONFIRMED`, `LINEUP_ASSIGNMENT_READY`, or any equivalent draft-state event. Today, a reconnect during Standard-mode's `LINEUP_ASSIGNMENT` screen (pre-`GAME_STATE`) already has no re-sync path — this is a pre-existing gap that Draft mode's D-13 requirement will newly expose and must close.
**Why it happens:** `room.status === 'playing'` becomes true the moment slot 2 joins (in `joinRoom`), long before `room.gameState` is ever built — so the reconnect gate's `room.gameState !== null` check silently no-ops for every phase before the game actually starts (team selection, uniform, formation, lineup, and now draft).
**How to avoid:** Extend the reconnect block in `createServer.ts` to also resend whatever pre-gameState state applies: if `room.teamType === 'draft'` and a `draftSession` exists and is not yet complete, re-emit `DRAFT_STATE_UPDATED` (the reconnecting player's private view) in addition to (or instead of) the `GAME_STATE` re-emit. This is new work this phase must do — it is not "already handled."
**Warning signs:** A reconnect test during an in-progress draft would show the client stuck on `LANDING`/whatever screen it was on at disconnect, or worse, `LINEUP_ASSIGNMENT` with `null` pack data, since no event ever arrives to re-populate local draft state.

### Pitfall 4: GK-slot lock is currently one-directional

**What goes wrong:** The existing `handleDragOver` early-return (`if (idx === 0) return;`) only blocks non-GK cards from being dropped ONTO the GK slot. It does NOT block a GK card from being dropped onto a non-GK slot — that direction has never been needed before (Standard mode's `computeAutoAssignment` always places the one GK correctly and GK never moves after that). D-09 requires this exact reverse-direction rule for Draft mode (a GK card must be rejected from every non-GK slot, since a player might draft 2+ keeper cards across the draft).
**How to avoid:** Extend `handleDragOver`/`handleDrop` validation to check the dragged card's `role === 'GK'` against the target slot's `slotRole === 'GK'` in both directions, with the rejection message copy already specified in UI-SPEC ("Swap rejected — goalkeeper slot requires a GK card.").
**Warning signs:** A player with 2 drafted keepers could otherwise place the second GK card into an outfield slot, producing an invalid lineup the server has no rule to catch.

### Pitfall 5: Pack-to-player random assignment must not leak via reused RNG state

**What goes wrong:** `generateMatchPacks` already produces 8 packs in an order determined by its own internal shuffle. If the pack→player assignment (D-04) simply slices `packs[0..3]` to home and `packs[4..7]` to away without an _additional_ independent random assignment step, it silently reintroduces the "fixed convention" the user explicitly rejected.
**How to avoid:** After calling `generateMatchPacks`, perform a **second**, independent `crypto.randomInt`-driven shuffle (Fisher-Yates, same pattern as the internal `shuffle` helper in `draftEngine.ts`) over the 8 pack indices, then split the shuffled result 4/4 between home and away. Keep this shuffle server-side only.
**Warning signs:** Playtesting across many rooms would show home always opening what were generated as "packs 1-4" — a statistically detectable pattern.

## Code Examples

### Room state extension (recommended shape)

```typescript
// Source: extends packages/server/src/roomStore.ts Room type, following the existing
// homeAssignment/awayAssignment/homeLineupConfirmed field-addition convention.
export type DraftSubStep = 'PICK1' | 'PICK2' | 'PICK3';

export type DraftSession = {
  cycle: number; // 1..4
  subStep: DraftSubStep;
  /** Packs indices assigned to each player, in the fixed sequential-open order for their 4 cycles (D-04). */
  homePackOrder: number[]; // indices into draftPacks, length 4
  awayPackOrder: number[]; // indices into draftPacks, length 4
  draftPacks: DraftPack[]; // the 8 generated packs (from generateMatchPacks)
  homeCurrentPack: TieredPoolPlayer[]; // player's currently-visible pack contents
  awayCurrentPack: TieredPoolPlayer[];
  homeDraftedIds: string[]; // accumulates to 16
  awayDraftedIds: string[];
  homeHasKeeper: boolean; // tracked for DRAFT-08 cycle-4 check
  awayHasKeeper: boolean;
  homePickedThisSubStep: boolean; // mutual-wait flag, reset after each advance
  awayPickedThisSubStep: boolean;
  homeLineupSlots: (string | null)[]; // 11 entries, null = empty
  awayLineupSlots: (string | null)[];
  homeBenchIds: string[]; // dynamic length
  awayBenchIds: string[];
  draftComplete: boolean;
};

// On Room:
draftSession?: DraftSession | null;
```

### Wiring pack generation at ROOM_SETTINGS_CONFIRM (recommended trigger point)

```typescript
// Source: packages/server/src/draftPacks.ts (existing forward-pointer comment, verbatim):
// "generateMatchPacks is the single authoritative entry point: Phase 29's
//  ROOM_SETTINGS_CONFIRM handler will call generateMatchPacks(room.draftPools) once per
//  match after teamType: 'draft' is locked in."
//
// Insert immediately after the existing lock-in lines in roomHandlers.ts:
room.gameSpeed = speed;
room.teamType = teamType;
room.draftPools = teamType === 'draft' ? draftPools : [];
room.settingsConfirmed = true;

if (teamType === 'draft') {
  const { packs } = generateMatchPacks(draftPools);
  // D-04: independent random shuffle of pack INDICES (not the pack contents) — do not
  // reuse generateMatchPacks' own internal shuffle order as the assignment.
  const shuffledIdx = shuffle([0, 1, 2, 3, 4, 5, 6, 7], randomInt); // crypto.randomInt-bound
  room.draftSession = {
    draftPacks: packs,
    homePackOrder: shuffledIdx.slice(0, 4),
    awayPackOrder: shuffledIdx.slice(4, 8),
    cycle: 0, // incremented to 1 when UNIFORM_CONFIRM away-branch opens the first pack
    // ... remaining fields initialized empty/false
  } as DraftSession;
}
```

### DRAFT_PICK event contract (recommended)

```typescript
// Source: follows LINEUP_SWAP/LINEUP_ASSIGNMENT_UPDATED naming + payload-shape convention
// (packages/shared/src/events.ts lines 73-83, 205-215).
[ClientEvents.DRAFT_PICK]: (payload: {
  cardId: string; // must be present in the player's current pack
  destination: { type: 'slot'; slotIndex: number } | { type: 'bench' };
}) => void;

[ServerEvents.DRAFT_STATE_UPDATED]: (state: {
  cycle: number;
  subStep: DraftSubStep;
  currentPack: TieredPoolPlayer[]; // THIS player's pack only — never the opponent's
  waitingForOpponent: boolean;
  lineupSlots: (string | null)[];
  benchIds: string[];
  keeperAutoPickedThisCycle: boolean; // drives the UI-SPEC banner
  draftComplete: boolean;
}) => void;
```

## State of the Art

| Old Approach                                      | Current Approach | When Changed                                                                        | Impact                                                                                           |
| ------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| n/a — this is a net-new feature area (draft mode) | —                | Phase 27 (settings), Phase 28 (data model), Phase 29 (this phase, UI/orchestration) | Draft mode is being built incrementally across 3 phases; no prior "old approach" to migrate from |

**Deprecated/outdated:** None — no existing draft-related code is being replaced, only extended (Standard-mode lineup assignment continues unchanged behind the `room.teamType !== 'draft'` branch).

## Assumptions Log

| #   | Claim                                                                                                                                                                                                                       | Section                                           | Risk if Wrong                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | The "pick 2 cards" sub-step is phase-boundary-gated (both cards freely pickable, mutual-wait only before SWAP_BACK), not per-card gated                                                                                     | Architecture Patterns §3, Common Pitfalls §1      | Medium — if the user actually intended a per-card gate, the planner would need to add an extra mutual-wait flag layer (`homePick2aDone`/`homePick2bDone`) and the UI's "waiting" indicator would need to appear/disappear twice per cycle instead of once; core state-machine shape still holds, just needs 2 more flags                                                                           |
| A2  | Pack generation should be triggered at `ROOM_SETTINGS_CONFIRM` time (not deferred to `UNIFORM_CONFIRM`/formation-confirm time)                                                                                              | Architecture Patterns, Code Examples              | Low — directly supported by an explicit forward-pointer comment already in `packages/server/src/draftPacks.ts`; low risk of being wrong, but if the team prefers generating later (e.g., to reduce room-memory footprint for rooms that abandon before reaching the draft), the trigger point would need to move to the `UNIFORM_CONFIRM` away-branch instead — a small relocation, not a redesign |
| A3  | Auto-selected keeper (DRAFT-08) is drawn from the player's OWN currently-visible pack at the point keeper-safety triggers (after cycle-4 PICK1), not from a "search all remaining cards" pool                               | Architecture Patterns §4                          | Low — backed by the verified Phase 28 invariant that every pack has exactly 1 keeper card; only fails if a future change to `PACK_COMPOSITION` ever reduces `keeper` below 1, which the Phase 28 `generateDraftPacks` code explicitly guards against with a throw (line 326-330)                                                                                                                   |
| A4  | Bench random jersey numbers (15-99) are ephemeral — they do not need to be threaded into `GameState`/`PlayerPiece` at all, since bench players never enter live gameplay (no substitution mechanic exists in this codebase) | Don't Hand-Roll, Architectural Responsibility Map | Low — verified directly: `buildInitialGameState`/`buildSquadPieces` only ever consumes the 11-entry `confirmedHomeOrder`/`confirmedAwayOrder`, and no substitution/bench-swap-during-match feature exists anywhere in `gameEngine.ts`                                                                                                                                                              |

## Open Questions (RESOLVED)

1. **Exact mutual-wait granularity for the 2-card PICK2 sub-step (see A1).**
   - What we know: D-01 groups "pick 2 cards" as one labeled phase; D-03 confirms a mutual-wait gate exists at "the next sub-step"; UI-SPEC shows a `Pick {k} of {2}` counter.
   - What's unclear: whether the counter blocks per-card or only at the phase boundary.
   - Recommendation: proceed with phase-boundary-only gating (simpler, matches "sub-step" language) but flag this specific mechanic for a quick human confirmation during plan review, since it's the single largest behavioral ambiguity in an otherwise fully-specified phase.
   - **RESOLVED:** Plan 02 implements phase-boundary-only mutual-wait gating — `advanceSubStep` is a no-op until BOTH players' `picksRemaining` reach 0 within a sub-step (no per-card gate); Plan 06's two-browser human-verify checkpoint re-confirms this A1 behavior in the live run.

2. **Should `DraftSession` cycle/sub-step advancement logic live in a new `draftSession.ts` module or inline in `roomHandlers.ts`?**
   - What we know: the existing codebase separates pure state-transition logic (`gameEngine.ts`) from socket-wiring (`roomHandlers.ts`) for testability.
   - What's unclear: whether this phase's state machine is complex enough to warrant its own module vs. being a contained block in the existing `DRAFT_PICK` handler.
   - Recommendation: given the state machine has ~7 distinct sub-step transitions plus the keeper-safety branch, extract to `packages/server/src/draftSession.ts` (pure functions, unit-testable in isolation) — mirrors the `gameEngine.ts` precedent exactly.
   - **RESOLVED:** Plan 02 extracts the state machine into `packages/server/src/draftSession.ts` as pure, unit-tested functions (mirroring `gameEngine.ts`); Plan 04 wires them into `roomHandlers.ts`. The dedicated module was chosen over an inline handler block.

## Environment Availability

Skipped — this phase has no new external dependencies (no new npm packages, no new external services/tools). Everything required (Node.js, Socket.io, React/Vite, vitest) is already installed and verified working by all 28 prior phases.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 2.1.9 (both `packages/server` and `packages/client`), `@testing-library/react` 14.3.1 + `@testing-library/user-event` 14.6.1 for client component tests                   |
| Config file        | `packages/client/vite.config.ts` (embedded `test` block, `environment: 'jsdom'`); `packages/server` uses Vitest defaults (no separate config file found — confirm during Wave 0) |
| Quick run command  | `pnpm --filter @counter-attack/server test -- draftSession` / `pnpm --filter @counter-attack/client test -- DraftPackCarousel` (scoped by filename pattern)                      |
| Full suite command | `pnpm -r test` (root-level, runs both packages)                                                                                                                                  |

### Phase Requirements → Test Map

| Req ID           | Behavior                                                                                                     | Test Type            | Automated Command                                                                                     | File Exists?                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| DRAFT-06         | Draft carousel renders above lineup grid on the correct screen                                               | component            | `vitest run src/components/LineupAssignmentScreen.test.tsx -t "draft"`                                | ❌ Wave 0 — no existing `LineupAssignmentScreen.test.tsx` found; new test file needed          |
| DRAFT-07         | Pick-and-swap cycle sequencing (1+2+1 ×4, pack swap, new-pack-open) resolves 16 cards/player                 | integration (socket) | `vitest run src/__tests__/draftSession.integration.test.ts`                                           | ❌ Wave 0 — new file, model on `lineupAssignment.integration.test.ts`'s real Socket.io harness |
| DRAFT-07         | Random pack→player assignment is not a fixed 0-3/4-7 split (statistical/property test or mock-RNG assertion) | unit                 | `vitest run src/__tests__/draftPacks.test.ts -t "assignment"`                                         | 🟡 existing file (`draftPacks.test.ts`) covers pack generation only — extend, don't duplicate  |
| DRAFT-08         | Keeper-safety auto-pick triggers correctly on cycle 4 when no keeper drafted yet                             | unit                 | `vitest run src/draftSession.test.ts -t "keeper"`                                                     | ❌ Wave 0 — new `draftSession.ts` module needs its own unit test file                          |
| DRAFT-09         | Bench renders dynamically-sized card list (0 to 16 cards), same visual as draft row                          | component            | `vitest run src/components/BenchCarousel.test.tsx` (or folded into `LineupAssignmentScreen.test.tsx`) | ❌ Wave 0                                                                                      |
| DRAFT-10         | Starters get slot-based numbers; bench gets random unique 15-99 numbers; no auto-repositioning occurs        | unit + integration   | `vitest run src/__tests__/draftSession.test.ts -t "numbering"`                                        | ❌ Wave 0                                                                                      |
| D-13 (reconnect) | Mid-draft reconnect resumes with correct private pack/lineup state                                           | integration (socket) | `vitest run src/__tests__/draftReconnect.integration.test.ts`                                         | ❌ Wave 0 — also exposes/closes the pre-existing gap noted in Pitfall 3                        |

### Sampling Rate

- **Per task commit:** targeted `vitest run <changed-file-pattern>` (quick run command above)
- **Per wave merge:** `pnpm -r test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/draftSession.ts` + `packages/server/src/draftSession.test.ts` — new pure state-machine module and its unit tests (cycle advance, keeper-safety, bench numbering)
- [ ] `packages/server/src/__tests__/draftSession.integration.test.ts` — full socket-wire pick-and-swap cycle test, modeled on `lineupAssignment.integration.test.ts`'s existing real-server harness
- [ ] `packages/server/src/__tests__/draftReconnect.integration.test.ts` — closes Pitfall 3's reconnect gap
- [ ] `packages/client/src/components/LineupAssignmentScreen.test.tsx` — currently does not exist at all (confirmed via file listing); needed to cover draft-mode rendering branches without regressing Standard-mode behavior
- [ ] `packages/client/src/components/DraftPackCarousel.test.tsx` (or equivalent) — carousel nav, tier-sort, variable pack size (6 vs 7 cards)
- [ ] Extend `packages/server/src/__tests__/draftPacks.test.ts` with a pack→player random-assignment case (currently only tests `generateDraftPacks`/`generateMatchPacks` directly, not the room-level assignment step, which doesn't exist yet)

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                             |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | Session-token-based room auth already established (Phase 3/16), unchanged by this phase                                                                                                                                                      |
| V3 Session Management | yes     | Reconnect/session-token flow must be extended (Pitfall 3) to cover mid-draft state — reuse existing `sessionToken`/`findPlayerByToken` mechanism, no new auth primitive                                                                      |
| V4 Access Control     | yes     | `DRAFT_PICK` handler must verify `socket.data.playerSlot` owns the card being picked and the pack it claims to be picking from (never trust a client-supplied "which pack" claim) — mirrors `LINEUP_SWAP`'s `T-24-03 spoofing guard` pattern |
| V5 Input Validation   | yes     | Allow-list validate `destination.slotIndex` range (existing `INVALID_SLOT_INDEX` pattern), validate `cardId` is actually present in the resolving player's server-stored current pack (never trust client-echoed card identity)              |
| V6 Cryptography       | yes     | Pack-to-player assignment and bench-number assignment must use `crypto.randomInt`, never `Math.random()` — same fairness rationale as dice/pack-generation (T-28-04-FAIR precedent)                                                          |

### Known Threat Patterns for this stack

| Pattern                                                                                                        | STRIDE                            | Standard Mitigation                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client claims a `cardId` not actually in their current pack (to draft an opponent's or already-discarded card) | Tampering                         | Server validates `cardId` against `room.draftSession.{home,away}CurrentPack` server-side state before accepting any `DRAFT_PICK` — never trust client-supplied pack contents                                                            |
| Client emits `DRAFT_PICK` for the opponent's slot/pack (impersonation)                                         | Spoofing                          | Resolve `playerSlot` from `socket.data.playerSlot` (server-set at join/reconnect), never from any client payload field — identical to every existing handler in `roomHandlers.ts`                                                       |
| Predictable pack→player assignment or bench numbering (weak RNG)                                               | Information Disclosure / fairness | `crypto.randomInt` exclusively, per T-28-04-FAIR precedent already established in `draftPacks.ts`                                                                                                                                       |
| Replay/duplicate `DRAFT_PICK` events during the `isProcessing` window causing double-draft of the same card    | Tampering                         | Reuse the existing `room.isProcessing` mutex pattern (every other stateful handler in `roomHandlers.ts` wraps its logic in `if (room.isProcessing) return; room.isProcessing = true; try {...} finally { room.isProcessing = false; }`) |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)

- `packages/shared/src/draftEngine.ts` (399 lines, full read) — `generateDraftPacks`, `assignTiers`, `TieredPoolPlayer`, `DraftPack`, `RandomIntFn`
- `packages/server/src/draftPacks.ts` (27 lines, full read) — `generateMatchPacks`, forward-pointer comment naming Phase 29 as the wiring point
- `packages/shared/src/types.ts` (lines 430-502) — `TeamType`, `DraftPoolId`, `SELECTABLE_DRAFT_POOLS`, `DraftTier`, `TIER_PERCENTILE_BOUNDS`, `PACKS_PER_MATCH=8`, `PACK_COMPOSITION`
- `packages/server/src/roomHandlers.ts` (full read of relevant sections, lines 1-428, 552-735) — `ROOM_SETTINGS_CONFIRM`, `UNIFORM_CONFIRM`, `LINEUP_SWAP`, `LINEUP_CONFIRM` handlers
- `packages/server/src/roomStore.ts` (348 lines, full read) — `Room` type, `broadcastState`, `findPlayerByToken`
- `packages/server/src/gameEngine.ts` (lines 100-265) — `scoreForRole`, `pickBest`, `computeAutoAssignment`, `buildSquadPieces` (confirms bench never enters `GameState`)
- `packages/server/src/createServer.ts` (lines 60-160) — reconnect handling, confirms the pre-gameState re-sync gap (Pitfall 3)
- `packages/client/src/components/LineupAssignmentScreen.tsx` (313 lines, full read) — drag-and-drop pattern, `LineupStatCard`, bench placeholder structure
- `packages/client/src/components/LineupAssignmentScreen.module.css` (312 lines, full read) — visual token source for tier-border extension
- `packages/client/src/App.tsx` (267 lines, full read) — routing, `onLineupAssignmentReady`, `handleLineupSwap`/`handleLineupConfirm`
- `packages/shared/src/events.ts` (285 lines, full read) — `ClientEvents`/`ServerEvents` naming and payload-shape conventions
- `packages/shared/src/formations.ts` (spot-checked `FormationSlot`/`jerseyNumber` shape) and `packages/server/src/__tests__/lineupAssignment.integration.test.ts` (confirms `jerseyNumber` is static per slot)
- `packages/shared/src/teams.ts` (`PoolPlayer` interface, lines 17-42) — confirms `number` field is source-squad-scoped, irrelevant to lineup display
- `.planning/phases/28-draft-data-model/28-VERIFICATION.md` (spot-checked) — confirms `generateDraftPacks`/`generateMatchPacks` fully verified, zero `Math.random`, no cross-pack duplication
- `.planning/phases/29-draft-ui-pick-and-swap-flow/29-CONTEXT.md`, `29-UI-SPEC.md`, `29-DISCUSSION-LOG.md` — full reads, user decisions and design contract
- `.planning/phases/28-draft-data-model/28-CONTEXT.md` — full read, prior-phase data-model decisions
- `.planning/REQUIREMENTS.md` (DRAFT section, lines 36-40, 88-92) — confirmed DRAFT-06..10 wording, noted the traceability table still lists "Phase 30" (stale, likely a renumbering artifact — flag for the planner/roadmap owner, not blocking)

### Secondary (MEDIUM confidence)

- None — every claim in this research was directly verified against the live repository this session; no WebSearch or external documentation lookup was needed since this phase is 100% same-repo pattern extension with zero new external libraries.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new dependencies, 100% reuse of already-installed/verified tooling
- Architecture: HIGH for the reused patterns (drag-and-drop, mutual-wait gate, per-socket privacy — all directly copied from live, tested code); MEDIUM for the new cycle/sub-step state machine's exact gating granularity (see Assumption A1 / Open Question 1)
- Pitfalls: HIGH — all 5 pitfalls were discovered by direct code reading (not inferred), each with an exact file/line citation

**Research date:** 2026-07-21
**Valid until:** 30 days (stable, same-repo research; no external library version drift risk since no new dependencies were introduced)
