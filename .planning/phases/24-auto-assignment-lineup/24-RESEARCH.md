# Phase 24: Auto-Assignment & Lineup — Research

**Researched:** 2026-07-10
**Domain:** Server algorithm + Socket.io event flow + React UI (drag-and-drop)
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: GK player (role === 'GK') is locked to GK slot (index 0) first, before any scoring.
- D-02: Anchor roles filled next (DEF-center, MID-central, FWD-central) — scored from all remaining non-GK players; highest score wins each anchor slot.
- D-03: Flex roles filled last (DEF-back, MID-wing, FWD-wing) — scored from remaining players after anchor slots are filled.
- D-04: Scoring formulas per slot role (exact formulas — see Architecture Patterns section).
- D-05: Tie-breaking — prefer player with lower source-team index (array order from `getSquadPlayers`). Deterministic; no randomness.
- D-06: Assignment result is `PlayerId[]` (11 entries) where `assignment[i]` maps to `FORMATIONS[formationId].slots[i]`.
- D-07: Remove `buildInitialGameState` call from away-confirm branch of `UNIFORM_CONFIRM` handler; insert auto-assignment + `LINEUP_ASSIGNMENT_READY` emit + new handlers.
- D-08: `LINEUP_SWAP` payload: `{ slotIndexA: number; slotIndexB: number }`. Validates both are outfield (not index 0). Emits `LINEUP_ASSIGNMENT_UPDATED` to requester socket only.
- D-09: GK slot (index 0) is immovable — server rejects any swap where either index is 0. Client must not allow drag from GK card.
- D-10: `LINEUP_CONFIRM` payload: `{ confirmedOrder: PlayerId[] }`. After both confirm, call `buildInitialGameState` and emit `GAME_STATE`.
- D-11: `buildSquadPieces` signature change: accepts explicit `confirmedHomeOrder: PoolPlayer[]` and `confirmedAwayOrder: PoolPlayer[]` parameters; no longer calls `getSquadPlayers` internally when these are provided.
- D-12: `LINEUP_ASSIGNMENT_UPDATED` emitted only to the requesting player's socket (not broadcast).
- D-13: New standalone component `LineupAssignmentScreen.tsx` + `.module.css`. Not an extension of `UniformSelectionScreen`.
- D-14: Horizontal pitch orientation — GK | DEF | MID | FWD columns left-to-right.
- D-15: Full stat card per slot: all 9 attributes + player first/last name + source role + assigned jersey number (from `FormationSlot.jerseyNumber`).
- D-16: Screen shows only current player's own lineup.
- D-17: Bench row at bottom — 5 empty slot placeholders in v1.3 only; structurally present for v1.4.
- D-18: Heading follows "MATCH SETUP: STEP 3" pattern; step number = 3 for both players.
- D-19: Swap mechanic: HTML5 native drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`). No new library.
- D-20: GK card not draggable — no drag cursor; locked appearance.
- D-21: Server validates swap and returns `LINEUP_ASSIGNMENT_UPDATED`; client updates from server response (server-authoritative).
- D-22: Multiple swaps allowed before confirming.
- D-23: Status messaging — active: `'Make your selections now!'`; waiting: `` `Waiting for ${waitingForLabel} Player to Lock in their Selection.` ``
- D-24: Post-confirm: cards non-draggable (locked). GK always locked.
- D-25 (corrected): Both players see lineup simultaneously after `LINEUP_ASSIGNMENT_READY`. Either may confirm in any order. No home-first gate on `LINEUP_CONFIRM`.

### Claude's Discretion

- Exact event names (`LINEUP_ASSIGNMENT_READY`, `LINEUP_ASSIGNMENT_UPDATED`) — follow existing `ServerEvents` naming convention in `events.ts`
- CSS layout approach for horizontal formation columns (CSS grid with 4 named column tracks recommended)
- Card width/height in horizontal layout
- Whether to create a `LineupStatCard` sub-component or extend `PlayerStatsPanel` via props — extending with `staticPiece?: PoolPlayer` is recommended
- Drag-over visual feedback (card highlight, swap indicator)
- Screen transition name in Zustand store (recommend `'LINEUP_ASSIGNMENT'`)

### Deferred Ideas (OUT OF SCOPE)

- `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` — Phase 25 scope
- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — Phase 25 scope
- `csv-consolidation-player-pool.md` — Phase 25+ scope
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                                                                                                                                                                                  | Research Support                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ASSIGN-01 | After both formations confirmed, server auto-assigns all 11 players to formation slots using weighted stat scoring: GK locked to GK slot first; anchor roles (CB/CM/CF) filled by highest weighted score next; flex roles (FB/winger/flex-mid) filled from remaining players | `computeAutoAssignment` pure function design in Architecture Patterns section   |
| ASSIGN-02 | Assignment result displayed to player (slot label → player name) before confirm; both players work independently in parallel                                                                                                                                                 | `LineupAssignmentScreen` component; parallel confirm flow (no home-first gate)  |
| ASSIGN-03 | Player can swap any two outfield players; server validates and broadcasts updated assignment; multiple swaps permitted                                                                                                                                                       | `LINEUP_SWAP` event + `LINEUP_ASSIGNMENT_UPDATED` response; HTML5 drag-and-drop |
| ASSIGN-04 | GK slot locked — only GK may occupy it; server rejects any swap that would move GK out                                                                                                                                                                                       | Index-0 guard in `LINEUP_SWAP` handler; `draggable` attribute absent on GK card |
| ASSIGN-05 | Player confirms assignment to proceed to KICK_OFF_SETUP; confirmed assignment positions each piece at corresponding formation hex coordinate                                                                                                                                 | `LINEUP_CONFIRM` handler → `buildInitialGameState` → `GAME_STATE` broadcast     |

</phase_requirements>

---

## Summary

Phase 24 is a **pure internal implementation phase** — no new npm dependencies. All work is within the existing Node.js + Socket.io + React + TypeScript monorepo. The phase spans three technical concerns:

**1. Server algorithm (ASSIGN-01):** A new pure function `computeAutoAssignment(squad: PoolPlayer[], slots: readonly FormationSlot[]): PoolPlayer[]` implements the greedy weighted-score assignment. The function is deterministic (no dice, no randomness) and produces an 11-element ordered array where index `i` maps to `FORMATIONS[formationId].slots[i]`.

**2. Server flow restructuring (ASSIGN-05):** The away-confirm branch of the `UNIFORM_CONFIRM` handler in `roomHandlers.ts` currently calls `buildInitialGameState` → `broadcastState` → `GAME_STATE`. Phase 24 removes those calls and replaces them with auto-assignment computation, room state storage, and per-socket `LINEUP_ASSIGNMENT_READY` emission. `buildInitialGameState` migrates to the new `LINEUP_CONFIRM` handler, which fires only after both players confirm their lineup.

**3. Client UI (ASSIGN-02, ASSIGN-03, ASSIGN-04):** A new `LineupAssignmentScreen` React component uses HTML5 native drag-and-drop (zero new dependencies) to let players swap outfield cards before confirming. The component is server-authoritative: every swap emits `LINEUP_SWAP`, and cards re-render only after the server responds with `LINEUP_ASSIGNMENT_UPDATED`.

**Primary recommendation:** Implement `computeAutoAssignment` as a standalone exported function in `gameEngine.ts` with dedicated unit tests before touching the handler restructuring. The algorithm is the highest-complexity new logic; verifying it in isolation is the lowest-risk sequencing.

---

## Architectural Responsibility Map

| Capability                                      | Primary Tier      | Secondary Tier | Rationale                                                                                                        |
| ----------------------------------------------- | ----------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Auto-assignment scoring                         | API / Backend     | —              | Server-authoritative; deterministic algorithm runs once per room; client never calculates assignments            |
| Assignment privacy (home sees only home lineup) | API / Backend     | —              | Server emits `LINEUP_ASSIGNMENT_READY` to individual sockets, not broadcast                                      |
| Swap validation (GK lock, phase guard)          | API / Backend     | —              | ASVS V5: all inputs validated server-side; client-side drag guard is UX-only                                     |
| Card display (stats, name, jersey)              | Frontend / Client | —              | Pure render from `LINEUP_ASSIGNMENT_READY` payload + local `PLAYER_POOL` resolution                              |
| Drag-and-drop interaction                       | Browser / Client  | —              | HTML5 native D&D; swap intent emitted to server; local drag state (dragSource, dropTarget) is ephemeral UI state |
| Screen routing                                  | Frontend / Client | —              | Zustand `screen` field; `LINEUP_ASSIGNMENT_READY` triggers `setScreen('LINEUP_ASSIGNMENT')`                      |
| Game state construction                         | API / Backend     | —              | `buildInitialGameState` remains server-only; called from `LINEUP_CONFIRM` handler after both players confirm     |

---

## Standard Stack

### Core (all existing — no new installs)

| Library            | Version         | Purpose                                                                                             | Why Standard                                  |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Socket.io (server) | 4.x             | `LINEUP_SWAP`, `LINEUP_CONFIRM` (C→S); `LINEUP_ASSIGNMENT_READY`, `LINEUP_ASSIGNMENT_UPDATED` (S→C) | Project constraint; established event pattern |
| React              | 18.3.1 (pinned) | `LineupAssignmentScreen` component; HTML5 drag-and-drop event handlers                              | Project constraint; pinned per STATE.md       |
| TypeScript         | 5.x             | All new types (`PlayerId` alias, new event interfaces)                                              | Project constraint                            |
| Zustand            | 4.5.7 (pinned)  | Add `'LINEUP_ASSIGNMENT'` to `Screen` union                                                         | Pinned per STATE.md                           |
| CSS Modules        | —               | `LineupAssignmentScreen.module.css`                                                                 | Established pattern; no Tailwind/shadcn       |

### Supporting

| Library                  | Version   | Purpose                                                                | When to Use                                                      |
| ------------------------ | --------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `@counter-attack/shared` | workspace | `PLAYER_POOL`, `FORMATIONS`, `FormationSlot`, `SlotRole`, `PoolPlayer` | Client-side ID→player resolution; slot metadata for card display |

### Package Legitimacy Audit

No new packages installed in this phase. HTML5 drag-and-drop is native browser API.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition         |
| ------- | -------- | --- | --------- | ----------- | ------- | ------------------- |
| (none)  | —        | —   | —         | —           | —       | No new dependencies |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
UNIFORM_CONFIRM (away confirms)
    │
    ▼
roomHandlers.ts — away-confirm branch
    │  store away team + formation
    │  ╔══════════════════════════════╗
    │  ║ computeAutoAssignment()      ║  ← NEW (server-only pure function)
    │  ║  squad = getSquadPlayers()   ║
    │  ║  returns PlayerId[] (11)     ║
    │  ╚══════════════════════════════╝
    │  store homeAssignment + awayAssignment in Room
    │
    ├──► socket(homeSocketId).emit(LINEUP_ASSIGNMENT_READY, homePlayerId[])
    ├──► socket(awaySocketId).emit(LINEUP_ASSIGNMENT_READY, awayPlayerId[])
    └──► io.to(room).emit(BOTH_FORMATIONS_CONFIRMED, homeFormation, awayFormation)
              ↓
         [client routes to LINEUP_ASSIGNMENT screen]

LineupAssignmentScreen
    │  resolve PlayerId[] → PoolPlayer[] via PLAYER_POOL
    │  display 4-column formation grid
    │  HTML5 drag-and-drop on outfield cards
    │
    ├── onDrop(slotA, slotB) ──► socket.emit(LINEUP_SWAP, {slotIndexA, slotIndexB})
    │       │
    │       ▼
    │   roomHandlers.ts — LINEUP_SWAP handler
    │       │  validate: neither index is 0; room in lineup phase; isProcessing mutex
    │       │  swap entries in room.homeAssignment[]/awayAssignment[]
    │       └──► socket.emit(LINEUP_ASSIGNMENT_UPDATED, updatedPlayerId[])
    │                    ↓
    │               [client re-renders cards from server payload]
    │
    └── onConfirm() ──► socket.emit(LINEUP_CONFIRM, {confirmedOrder: PlayerId[]})
            │
            ▼
        roomHandlers.ts — LINEUP_CONFIRM handler
            │  store confirmed flag for this player
            │  if both confirmed:
            │      resolve PlayerId[] → PoolPlayer[] for home + away
            │      buildInitialGameState(confirmedHomeOrder, confirmedAwayOrder)
            └──► io.to(room).emit(GAME_STATE, gameState)
                        ↓
                  [client routes to GAME_BOARD]
```

### Recommended Project Structure (Phase 24 additions)

```
packages/
├── shared/src/
│   └── events.ts           — add 4 new events (LINEUP_ASSIGNMENT_READY, LINEUP_ASSIGNMENT_UPDATED,
│                              LINEUP_SWAP, LINEUP_CONFIRM) + their typed interfaces
├── server/src/
│   ├── roomHandlers.ts     — restructure away-confirm branch; add LINEUP_SWAP + LINEUP_CONFIRM handlers
│   ├── roomStore.ts        — add 4 fields to Room type (homeAssignment, awayAssignment,
│   │                          homeLineupConfirmed, awayLineupConfirmed)
│   └── gameEngine.ts       — add computeAutoAssignment(); update buildSquadPieces() signature;
│                              update buildInitialGameState() signature
└── client/src/
    ├── App.tsx             — add LINEUP_ASSIGNMENT_READY/UPDATED handlers; add LINEUP_ASSIGNMENT screen case;
    │                         remove formationsLocked placeholder branch
    ├── store/useGameStore.ts — add 'LINEUP_ASSIGNMENT' to Screen union
    ├── components/
    │   ├── LineupAssignmentScreen.tsx    — new component
    │   ├── LineupAssignmentScreen.module.css
    │   └── PlayerStatsPanel.tsx         — export STAT_LABELS (currently unexported const)
    └── __tests__/
        └── (new test files per Validation Architecture section)
```

---

### Pattern 1: computeAutoAssignment — Greedy Weighted Scoring

**What:** Pure function that assigns 11 squad players to 11 formation slots using the D-04 scoring formulas. No randomness. Three-pass strategy: GK first, anchors second, flex last.

**When to use:** Called once per team after both formations confirmed in the away-confirm branch of `UNIFORM_CONFIRM`.

**Source:** CONTEXT.md D-01 through D-06 (locked decisions). [ASSUMED] — implementation pattern derived from context decisions, verified against existing `buildSquadPieces` logic.

```typescript
// Source: CONTEXT.md D-04 scoring formulas + D-01/D-02/D-03 ordering
// Lives in packages/server/src/gameEngine.ts (server-only; PoolPlayer not re-exported to client raw)

import type { PoolPlayer } from '@counter-attack/shared';
import type { FormationSlot, SlotRole } from '@counter-attack/shared';

/** Exported for unit testing in gameEngine.phase24.test.ts */
export function computeAutoAssignment(
  squad: PoolPlayer[],
  slots: readonly FormationSlot[],
): PoolPlayer[] {
  const result: (PoolPlayer | null)[] = new Array(slots.length).fill(null);
  // Track original squad indices for deterministic tie-breaking (D-05)
  const available: Array<{ player: PoolPlayer; origIdx: number }> = squad.map((p, i) => ({
    player: p,
    origIdx: i,
  }));

  // --- Pass 1: Lock GK to slot 0 ---
  const gkEntry = available.find((e) => e.player.role === 'GK');
  if (gkEntry) {
    result[0] = gkEntry.player;
    available.splice(available.indexOf(gkEntry), 1);
  }

  // --- Pass 2: Fill anchor roles ---
  const ANCHOR_ROLES: SlotRole[] = ['DEF-center', 'MID-central', 'FWD-central'];
  for (let i = 1; i < slots.length; i++) {
    if (!ANCHOR_ROLES.includes(slots[i]!.slotRole)) continue;
    const best = pickBest(available, slots[i]!.slotRole);
    result[i] = best.player;
    available.splice(available.indexOf(best), 1);
  }

  // --- Pass 3: Fill flex roles ---
  for (let i = 1; i < slots.length; i++) {
    if (result[i] !== null) continue;
    const best = pickBest(available, slots[i]!.slotRole);
    result[i] = best.player;
    available.splice(available.indexOf(best), 1);
  }

  return result as PoolPlayer[];
}

function pickBest(
  available: Array<{ player: PoolPlayer; origIdx: number }>,
  slotRole: SlotRole,
): { player: PoolPlayer; origIdx: number } {
  const scored = available.map((e) => ({ ...e, score: scoreForRole(e.player, slotRole) }));
  // Sort: highest score first; on tie, prefer lower origIdx (D-05: source-team array order)
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.origIdx - b.origIdx));
  return scored[0]!;
}

function scoreForRole(player: PoolPlayer, slotRole: SlotRole): number {
  const r = player.role;
  switch (slotRole) {
    case 'FWD-central':
      // D-04: shooting + aerialAbility + (2 if role=FWD) + (4 if role=ST)
      return player.shooting + player.aerialAbility + (r === 'FWD' ? 2 : 0) + (r === 'ST' ? 4 : 0);
    case 'FWD-wing':
      // D-04: dribbling + highPass + (3 if role=FWD) + (2 if role=MID)
      return (
        player.dribbling +
        player.highPass +
        (r === 'FWD' || r === 'ST' ? 3 : 0) +
        (r === 'MID' ? 2 : 0)
      );
    case 'DEF-center':
      // D-04: tackling + aerialAbility + (2 if role=DEF)
      return player.tackling + player.aerialAbility + (r === 'DEF' ? 2 : 0);
    case 'DEF-back':
      // D-04: tackling + pace + (2 if role=DEF)
      return player.tackling + player.pace + (r === 'DEF' ? 2 : 0);
    case 'MID-central':
      // D-04: dribbling + tackling + pace + shooting + (3 if role=MID)
      return (
        player.dribbling + player.tackling + player.pace + player.shooting + (r === 'MID' ? 3 : 0)
      );
    case 'MID-wing':
      // D-04: dribbling + highPass + (3 if role=FWD) + (2 if role=MID)
      return (
        player.dribbling +
        player.highPass +
        (r === 'FWD' || r === 'ST' ? 3 : 0) +
        (r === 'MID' ? 2 : 0)
      );
    case 'GK':
      return 0; // assigned in pass 1, never scored here
  }
}
```

**Key insight:** The `FWD-wing` and `MID-wing` scoring formulas are identical per D-04 (both use dribbling + highPass + FWD/MID bonus). This is intentional per the Phase 23 deferred design.

**FWD-wing bonus clarification:** The D-04 formula says `(3 if role=FWD)`. In `PoolPlayer.role`, both `'FWD'` and `'ST'` are distinct values. The bonus applies to `role === 'FWD'`. However, some squads use `role === 'ST'` for their striker. The CONTEXT.md formula listing shows `(3 if role=FWD)` not `(3 if role=FWD or ST)`. Confirm with user if ST players should receive the FWD-wing bonus — current implementation applies +3 for both FWD and ST (forward-oriented roles) as the most reasonable interpretation. [ASSUMED] — confirm before coding.

---

### Pattern 2: Room State Extension

**What:** Four new optional fields on `Room` in `roomStore.ts` to track assignment and confirm state between `UNIFORM_CONFIRM` (when assignment is computed) and `LINEUP_CONFIRM` (when game starts).

```typescript
// packages/server/src/roomStore.ts — add to Room type
export type Room = {
  // ... existing fields ...

  /**
   * Phase 24: Auto-assignment result for home team. PlayerId[] (11 entries).
   * Set in UNIFORM_CONFIRM away-branch; mutated by LINEUP_SWAP; consumed by LINEUP_CONFIRM.
   * null = assignments not yet computed.
   */
  homeAssignment?: string[] | null;
  /** Phase 24: Auto-assignment result for away team. */
  awayAssignment?: string[] | null;
  /** Phase 24: true after home player emits LINEUP_CONFIRM. */
  homeLineupConfirmed?: boolean;
  /** Phase 24: true after away player emits LINEUP_CONFIRM. */
  awayLineupConfirmed?: boolean;
};
```

---

### Pattern 3: New Events in events.ts

**What:** Four new typed events following the existing `ClientEvents` / `ServerEvents` const-object pattern.

```typescript
// packages/shared/src/events.ts — additions

export const ClientEvents = {
  // ... existing ...
  /** Phase 24: swap two outfield slot indices. Payload: { slotIndexA, slotIndexB }. */
  LINEUP_SWAP: 'lineup:swap',
  /** Phase 24: confirm current assignment ordering. Payload: { confirmedOrder: PlayerId[] }. */
  LINEUP_CONFIRM: 'lineup:confirm',
} as const;

export const ServerEvents = {
  // ... existing ...
  /** Phase 24: sent to individual player socket with their team's auto-assignment. */
  LINEUP_ASSIGNMENT_READY: 'lineup:assignment-ready',
  /** Phase 24: sent to the requesting socket after a validated LINEUP_SWAP. */
  LINEUP_ASSIGNMENT_UPDATED: 'lineup:assignment-updated',
} as const;

// Type interfaces additions:
export interface ClientToServerEvents {
  // ... existing ...
  [ClientEvents.LINEUP_SWAP]: (payload: { slotIndexA: number; slotIndexB: number }) => void;
  [ClientEvents.LINEUP_CONFIRM]: (payload: { confirmedOrder: string[] }) => void;
}

export interface ServerToClientEvents {
  // ... existing ...
  /** Phase 24: assignment is PlayerId[] (11 entries); client resolves to PoolPlayer[] via PLAYER_POOL. */
  [ServerEvents.LINEUP_ASSIGNMENT_READY]: (assignment: string[]) => void;
  [ServerEvents.LINEUP_ASSIGNMENT_UPDATED]: (assignment: string[]) => void;
}
```

---

### Pattern 4: buildSquadPieces Signature Change

**What:** `buildSquadPieces` currently calls `getSquadPlayers(selectedTeams.home)` internally. After Phase 24, callers pass pre-resolved `PoolPlayer[]` arrays in slot order. [VERIFIED: codebase — packages/server/src/gameEngine.ts lines 115-181]

```typescript
// BEFORE (current):
function buildSquadPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
  selectedFormation: { home: FormationId; away: FormationId },
): PlayerPiece[];
// internally calls getSquadPlayers(selectedTeams.home)

// AFTER (Phase 24):
function buildSquadPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
  selectedFormation: { home: FormationId; away: FormationId },
  confirmedHomeOrder?: PoolPlayer[], // explicit ordering; falls back to getSquadPlayers if absent
  confirmedAwayOrder?: PoolPlayer[], // explicit ordering; falls back to getSquadPlayers if absent
): PlayerPiece[];
// uses confirmedHomeOrder ?? getSquadPlayers(selectedTeams.home)
```

`buildInitialGameState` and `buildKickOffPieces` gain matching optional parameters and thread them through.

**Note:** `buildKickOffPieces` (used after goals for piece reset) does NOT need the confirmed order — goals reset to default formation positions, not the player's chosen assignment. Only the initial lineup call uses confirmed order.

---

### Pattern 5: LINEUP_CONFIRM Handler — Player ID Resolution

**What:** The `LINEUP_CONFIRM` handler receives `confirmedOrder: string[]` (player IDs). Before calling `buildInitialGameState`, it must resolve IDs to `PoolPlayer` objects.

```typescript
// packages/server/src/roomHandlers.ts — LINEUP_CONFIRM handler
import { PLAYER_POOL } from '@counter-attack/shared';

// Resolve PlayerId[] → PoolPlayer[]
const confirmedHomeOrder = room.homeAssignment!.map((id) => PLAYER_POOL.find((p) => p.id === id)!);
const confirmedAwayOrder = room.awayAssignment!.map((id) => PLAYER_POOL.find((p) => p.id === id)!);
// Note: server stores the VALIDATED assignment (from last LINEUP_SWAP or initial computation).
// The client's confirmedOrder is validated against room.homeAssignment/awayAssignment to prevent tampering.
```

**Security note (ASVS V5):** The server must validate `confirmedOrder` matches the stored `room.homeAssignment` / `room.awayAssignment`. The client's `LINEUP_CONFIRM` payload is an attestation, not a command — the server uses its own stored assignment. Simplest safe implementation: ignore the client's `confirmedOrder` entirely and use `room.homeAssignment` / `room.awayAssignment` directly.

---

### Pattern 6: Per-Socket Emit for Lineup Privacy

**What:** `LINEUP_ASSIGNMENT_READY` and `LINEUP_ASSIGNMENT_UPDATED` go to the requesting player's socket only. [VERIFIED: codebase — roomHandlers.ts pattern for per-socket GAME_ERROR emits]

```typescript
// In UNIFORM_CONFIRM away-confirm branch:
const homeSocket = io.sockets.sockets.get(room.players[0]!.socketId);
const awaySocket = io.sockets.sockets.get(room.players[1]!.socketId);
homeSocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.homeAssignment!);
awaySocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.awayAssignment!);
```

---

### Pattern 7: HTML5 Drag-and-Drop in LineupStatCard

**What:** Native browser API. No React DnD library. [ASSUMED] — standard HTML5 API; no existing D&D in this codebase.

```tsx
// In LineupAssignmentScreen.tsx or LineupStatCard sub-component
const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

// On each card:
<div
  className={cardClass}
  draggable={isDraggable} // false for GK (slot 0), false after confirm
  onDragStart={(e) => {
    setDragSourceIndex(slotIndex);
    e.dataTransfer.setData('text/plain', String(slotIndex));
    e.dataTransfer.effectAllowed = 'move';
  }}
  onDragOver={(e) => {
    if (slotIndex === 0) return; // GK slot: no drop highlight
    e.preventDefault(); // required to allow drop
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(slotIndex);
  }}
  onDragLeave={() => setDropTargetIndex(null)}
  onDrop={(e) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex !== slotIndex && slotIndex !== 0) {
      onSwap(sourceIndex, slotIndex); // emits LINEUP_SWAP to server
    }
    setDropTargetIndex(null);
    setDragSourceIndex(null);
  }}
  onDragEnd={() => {
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }}
/>;
```

**Key API note:** `e.preventDefault()` in `onDragOver` is what enables the drop. Without it the browser shows the "no drop" cursor and `onDrop` never fires.

---

### Pattern 8: App.tsx Screen Routing Addition

**What:** Replace the `formationsLocked` placeholder with the `LINEUP_ASSIGNMENT` screen. [VERIFIED: codebase — App.tsx lines 171-175]

```tsx
// BEFORE:
} : screen === 'UNIFORM_SELECTION' && formationsLocked ? (
  <p style={{ color: '#e0e0e0', textAlign: 'center', marginTop: '40px' }}>
    Both formations confirmed. Starting game…
  </p>
) : screen === 'UNIFORM_SELECTION' ? (

// AFTER:
} : screen === 'LINEUP_ASSIGNMENT' ? (
  <LineupAssignmentScreen
    assignment={lineupAssignment!}
    formationId={myFormationId!}
    playerSlot={playerSlot!}
    onSwap={handleLineupSwap}
    onConfirm={handleLineupConfirm}
    lineupConfirmed={lineupConfirmed}
  />
) : screen === 'UNIFORM_SELECTION' ? (

// New socket handler:
function onLineupAssignmentReady(assignment: string[]) {
  setLineupAssignment(assignment);
  setScreen('LINEUP_ASSIGNMENT');
}
function onLineupAssignmentUpdated(assignment: string[]) {
  setLineupAssignment(assignment);
}
```

The `formationsLocked` state and `onBothFormationsConfirmed` handler can be removed (or made a no-op) since `LINEUP_ASSIGNMENT_READY` replaces the screen transition trigger.

---

### Anti-Patterns to Avoid

- **Calling `buildInitialGameState` in the away-confirm branch after Phase 24:** The game must not start until both players confirm their lineup. The away-confirm branch now terminates with `LINEUP_ASSIGNMENT_READY`, not `GAME_STATE`. [VERIFIED: codebase — roomHandlers.ts lines 379-399]
- **Using `io.to(roomCode).emit` for lineup events:** Assignment data is private. Use `socket.emit` (for per-player data) or `io.sockets.sockets.get(socketId)?.emit` when sending from outside the socket's own handler.
- **Copying the home-first sequential confirm gate for LINEUP_CONFIRM:** The `UNIFORM_CONFIRM` handler uses a `playerSlot === 1` first-guard. `LINEUP_CONFIRM` explicitly does NOT do this — both players confirm in parallel (D-25 corrected). [VERIFIED: codebase — roomHandlers.ts lines 323-334]
- **Skipping the `isProcessing` mutex on LINEUP_SWAP and LINEUP_CONFIRM:** All game-state mutations use the same per-room mutex. [VERIFIED: codebase — roomHandlers.ts mutex pattern]
- **Re-declaring STAT_LABELS in LineupStatCard:** `STAT_LABELS` is currently a module-level const in `PlayerStatsPanel.tsx` but not exported. Export it from `PlayerStatsPanel.tsx` and import it in `LineupStatCard`. Do not duplicate it.
- **Overwriting the `confirmedOrder` from the server with the client payload:** The client sends `confirmedOrder` as a convenience but the server should use `room.homeAssignment` / `room.awayAssignment` (the stored, validated state) to construct the game. This prevents client-side tampering with the assignment (ASVS V5).
- **Storing the game-phase intermediate state in Zustand:** The `lineupAssignment` and `lineupConfirmed` state are App.tsx local state (like `homePickedTeam`, `homeConfirmedFormation`). They are pre-game metadata, not game state. Do not put them in the Zustand store's `gameState`.

---

## Don't Hand-Roll

| Problem                            | Don't Build                                            | Use Instead                                                                                                         | Why                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Drag-and-drop reorder              | Custom touch event tracking or pointer events          | HTML5 native `draggable` / `onDragStart` / `onDrop`                                                                 | Desktop-first constraint; zero dependencies; already decided in D-19                                                         |
| Player lookup by ID                | Linear scan in component render                        | `PLAYER_POOL` imported from `@counter-attack/shared`; build a `Map<string, PoolPlayer>` at component initialization | O(1) lookup for 188 players during render; PLAYER_POOL is already the shared source of truth                                 |
| Scored assignment without priority | Single-pass scoring across all 11 slots simultaneously | Three-pass greedy (GK first → anchors → flex) per D-01/D-02/D-03                                                    | Single-pass would allow GK to be displaced from GK slot if another player scores higher for that slot                        |
| Random assignment                  | `Math.random()` for tie-breaking                       | Source-team index (original `getSquadPlayers` array order) per D-05                                                 | Determinism required; same squad always produces same assignment; same logic as crypto.randomInt discipline already enforced |

**Key insight:** The assignment algorithm is deterministic and runs in O(n²) time at most (11 slots × 11 players), which is negligible. No need for priority queues or sophisticated algorithms.

---

## Common Pitfalls

### Pitfall 1: `formationsLocked` placeholder is NOT the same screen as LineupAssignment

**What goes wrong:** Phase 24 implementer keeps the `formationsLocked` branch in App.tsx and tries to show the lineup screen within it, rather than adding a new `'LINEUP_ASSIGNMENT'` screen case.

**Why it happens:** The placeholder was added by Phase 23 as a temporary signal that "both formations confirmed; game starting soon." Phase 24 must remove this placeholder and add a proper screen case.

**How to avoid:** Add `'LINEUP_ASSIGNMENT'` to the `Screen` union in `useGameStore.ts` and add it to the render switch in App.tsx. The `LINEUP_ASSIGNMENT_READY` handler calls `setScreen('LINEUP_ASSIGNMENT')`. The `formationsLocked` branch and state are then dead code to be deleted.

**Warning signs:** The app shows "Both formations confirmed. Starting game…" text when it should show the lineup screen.

---

### Pitfall 2: Socket not found via `io.sockets.sockets.get(socketId)` if player reconnected

**What goes wrong:** A player disconnects and reconnects within the grace period. Their `socketId` in `room.players[0].socketId` updates on reconnect (createServer.ts reconnect handler updates it). If the `UNIFORM_CONFIRM` away-confirm fires after a reconnect, the stored `socketId` may be stale.

**Why it happens:** Socket IDs are connection-specific; they change on each new connection. The room store updates `socketId` on reconnect, but if there's a race between the reconnect handler updating the ID and the away-confirm branch reading it, the emit might go to a dead socket.

**How to avoid:** Emit `LINEUP_ASSIGNMENT_READY` immediately in the away-confirm handler (same transaction as storing the assignment). The reconnect flow re-emits game state via `broadcastState` — consider whether `LINEUP_ASSIGNMENT_READY` needs to be re-emitted on reconnect. For v1.3, a reconnect while in lineup phase is an edge case; document the gap and handle it as a follow-up.

**Warning signs:** Player reconnects and the lineup screen never appears (stuck on "Both formations confirmed. Starting game…").

---

### Pitfall 3: `onDragOver` not calling `e.preventDefault()` → drop never fires

**What goes wrong:** `onDrop` handler never triggers because the browser defaults to "no drop" mode.

**Why it happens:** HTML5 D&D requires `e.preventDefault()` in `onDragOver` to signal that this element accepts drops. Without it, the `onDrop` event is not dispatched.

**How to avoid:** Always call `e.preventDefault()` in `onDragOver`. For the GK card (slot 0), deliberately do NOT call it to show the browser's "no drop" cursor.

**Warning signs:** Dragging a card over another card shows the "forbidden" cursor; releasing does nothing.

---

### Pitfall 4: `LINEUP_CONFIRM` handler triggers before BOTH players confirm

**What goes wrong:** `buildInitialGameState` is called after only one player confirms, starting the game prematurely.

**Why it happens:** Implementer copies the `UNIFORM_CONFIRM` home-first pattern where the second event triggers the game start. Here, both `LINEUP_CONFIRM` events from either player independently increment a counter; only when BOTH are true should the game start.

**How to avoid:** After setting the confirming player's flag:

```typescript
if (room.homeLineupConfirmed && room.awayLineupConfirmed) {
  // build and broadcast game state
}
```

**Warning signs:** Game starts immediately after first player clicks "Confirm Lineup" before the second player acts.

---

### Pitfall 5: Jersey numbers shown in LineupStatCard must come from slot, not PoolPlayer

**What goes wrong:** `LineupStatCard` displays `player.number` (the source squad number, e.g., 7 for a midfielder) instead of `FormationSlot.jerseyNumber` (the tactical jersey number assigned to that slot, e.g., 6 for an RCM slot).

**Why it happens:** `PoolPlayer.number` exists and is the obvious choice, but it's the player's number in their source squad. Formation slots have their own jersey numbering (1-11 per Phase 23 D-14).

**How to avoid:** Each `LineupStatCard` receives both `player: PoolPlayer` AND `slotMeta: FormationSlot`. Display `slotMeta.jerseyNumber` in the header, NOT `player.number`.

**Warning signs:** Player cards show numbers like 7, 11, 4 from their source squad instead of the formation's sequential jersey numbers (1-11).

---

### Pitfall 6: `STAT_LABELS` is not exported from `PlayerStatsPanel.tsx`

**What goes wrong:** `LineupStatCard` cannot import `STAT_LABELS` from `PlayerStatsPanel.tsx` because it is a module-level const but has no `export` keyword.

**Why it happens:** `PlayerStatsPanel` was written as a self-contained component; `STAT_LABELS` was never designed to be shared.

**How to avoid:** Add `export` to `STAT_LABELS` in `PlayerStatsPanel.tsx`. This is a one-character change to an existing file. Do not re-declare the array in `LineupStatCard`.

**Warning signs:** TypeScript import error on `import { STAT_LABELS } from './PlayerStatsPanel.js'`.

---

### Pitfall 7: Drag state (`dragSourceIndex`, `dropTargetIndex`) must NOT be emitted to server

**What goes wrong:** Implementer stores drag state in Zustand and accidentally treats it as game state to be synced.

**Why it happens:** Zustand is used for game state; it's tempting to put all interactive state there.

**How to avoid:** Drag state is ephemeral local component state — `useState` inside `LineupAssignmentScreen`. Only `LINEUP_SWAP` (on drop) and `LINEUP_CONFIRM` (on button click) are ever emitted to the server. The card array displayed is always rebuilt from the server-returned `assignment: string[]`.

---

### Pitfall 8: `buildKickOffPieces` must NOT accept confirmedOrder

**What goes wrong:** Implementer propagates the `confirmedHomeOrder` parameter to `buildKickOffPieces`, causing post-goal resets to use the original lineup assignment (which may have been swapped by the player).

**Why it happens:** `buildKickOffPieces` wraps `buildSquadPieces` and the implementer carries the param change through.

**How to avoid:** `buildKickOffPieces` calls `buildSquadPieces` WITHOUT `confirmedHomeOrder`/`confirmedAwayOrder` (falls back to `getSquadPlayers`). Goal resets place players at their DEFAULT formation positions (slot index = source squad index from `getSquadPlayers`), not the player-chosen assignment order. [ASSUMED] — confirm: should post-goal reset honor the confirmed player-slot assignment? If yes, the game state must store the confirmed orderings. For v1.3 treat as using default formation mapping per current `buildKickOffPieces` behavior.

---

## Runtime State Inventory

> Phase 24 is not a rename/refactor phase. No runtime state migration required. Omit.

---

## Environment Availability

> Phase 24 has no new external dependencies. All tools already verified in prior phases.

| Dependency     | Required By | Available | Version                     | Fallback |
| -------------- | ----------- | --------- | --------------------------- | -------- |
| Node.js 22 LTS | Server      | ✓         | 24.15.0 (current)           | —        |
| pnpm           | Build       | ✓         | 9.x                         | —        |
| Vitest         | Tests       | ✓         | (server package configured) | —        |

**Missing dependencies with no fallback:** none

---

## Validation Architecture

### Test Framework

| Property           | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| Framework          | Vitest (server)                                          |
| Config file        | `packages/server/vitest.config.ts`                       |
| Quick run command  | `pnpm --filter @counter-attack/server run test -- --run` |
| Full suite command | `pnpm --filter @counter-attack/server run test -- --run` |

Current baseline: 506 tests passing, 1 skipped, 0 failing. [VERIFIED: codebase — ran suite 2026-07-10]

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                                        | Test Type   | Automated Command                                                                                           | File Exists? |
| --------- | ----------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- | ------------ |
| ASSIGN-01 | `computeAutoAssignment` fills GK first, then anchors, then flex                                 | unit        | `pnpm --filter @counter-attack/server run test -- --run src/__tests__/gameEngine.phase24.test.ts`           | ❌ Wave 0    |
| ASSIGN-01 | Scoring formula for each SlotRole produces correct numeric result                               | unit        | same file                                                                                                   | ❌ Wave 0    |
| ASSIGN-01 | Tie-breaking prefers lower source-team index                                                    | unit        | same file                                                                                                   | ❌ Wave 0    |
| ASSIGN-03 | `LINEUP_SWAP` handler validates GK lock (rejects index 0)                                       | integration | `pnpm --filter @counter-attack/server run test -- --run src/__tests__/lineupAssignment.integration.test.ts` | ❌ Wave 0    |
| ASSIGN-03 | `LINEUP_SWAP` handler swaps valid outfield slots and emits updated assignment to requester only | integration | same file                                                                                                   | ❌ Wave 0    |
| ASSIGN-04 | `LINEUP_SWAP` with slotIndexA=0 rejected; emits GAME_ERROR                                      | integration | same file                                                                                                   | ❌ Wave 0    |
| ASSIGN-05 | After both `LINEUP_CONFIRM` events received, `GAME_STATE` is broadcast                          | integration | same file                                                                                                   | ❌ Wave 0    |
| ASSIGN-05 | Single `LINEUP_CONFIRM` (one player only) does NOT trigger `GAME_STATE`                         | integration | same file                                                                                                   | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/server run test -- --run`
- **Per wave merge:** `pnpm --filter @counter-attack/server run test -- --run`
- **Phase gate:** Full suite green (506+ tests) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/__tests__/gameEngine.phase24.test.ts` — covers ASSIGN-01 (unit tests for `computeAutoAssignment` and `scoreForRole`)
- [ ] `packages/server/src/__tests__/lineupAssignment.integration.test.ts` — covers ASSIGN-03, ASSIGN-04, ASSIGN-05 (integration tests with real Socket.io server)

_(Existing test infrastructure is sufficient — no new framework install required)_

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                  |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | Not applicable — no new auth flows                                                                                                                                                                                |
| V3 Session Management | no      | Existing session middleware unchanged                                                                                                                                                                             |
| V4 Access Control     | yes     | Server validates: emitting player can only swap/confirm their own team's assignment; no cross-team write                                                                                                          |
| V5 Input Validation   | yes     | `LINEUP_SWAP` payload validates `slotIndexA/B` are integers in range [0,10], both non-zero; `LINEUP_CONFIRM` ignores client's `confirmedOrder` payload and uses server's stored state (ASVS V5 tamper-prevention) |
| V6 Cryptography       | no      | Not applicable — no cryptographic operations                                                                                                                                                                      |

### Known Threat Patterns for this Stack

| Pattern                                                           | STRIDE    | Standard Mitigation                                                                                                              |
| ----------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Swap both indices to 0 to attempt GK displacement                 | Tampering | Server guard: `if (slotIndexA === 0 \|\| slotIndexB === 0)` → emit `GAME_ERROR('GK_SLOT_LOCKED')`                                |
| Client sends out-of-range slot indices (negative, > 10)           | Tampering | Server guard: `if (slotIndexA < 0 \|\| slotIndexA > 10 \|\| slotIndexB < 0 \|\| slotIndexB > 10)`                                |
| Client sends `LINEUP_CONFIRM` with fabricated `confirmedOrder`    | Tampering | Server ignores payload and uses `room.homeAssignment` / `room.awayAssignment` (stored state)                                     |
| Player emits `LINEUP_SWAP` for opponent's team                    | Spoofing  | Server checks `playerSlot` from `socket.data` — only slot 1 can modify `homeAssignment`; only slot 2 can modify `awayAssignment` |
| Double-confirm race (two rapid `LINEUP_CONFIRM` from same player) | Tampering | `isProcessing` mutex + idempotent flag check: if `room.homeLineupConfirmed` already true, ignore                                 |

---

## Code Examples

### Existing: UNIFORM_CONFIRM away-confirm branch (to be restructured)

```typescript
// Source: packages/server/src/roomHandlers.ts — lines 363-404 [VERIFIED: codebase]
// This entire block is the restructuring target. Currently calls buildInitialGameState
// immediately. Phase 24 removes that call and inserts computeAutoAssignment + LINEUP_ASSIGNMENT_READY.
room.awayPickedTeam = teamId;
room.awayPickedFormation = formationId;
const selectedTeams = { home: room.homePickedTeam!, away: teamId };
// ... buildInitialGameState called here — REMOVE in Phase 24 ...
room.gameState = gameState;
broadcastState(io, room); // REMOVE — game doesn't start here
io.to(roomCode).emit(
  ServerEvents.BOTH_FORMATIONS_CONFIRMED,
  room.homePickedFormation!,
  formationId,
);
```

### Existing: Per-socket emit pattern (for LINEUP_ASSIGNMENT_READY)

```typescript
// Source: packages/server/src/roomHandlers.ts — socket.emit(ServerEvents.GAME_ERROR, ...) pattern [VERIFIED: codebase]
// Individual socket emits use the socket reference directly (socket.emit)
// For emitting to a specific socket from outside that socket's handler:
const homeSocket = io.sockets.sockets.get(room.players[0]!.socketId);
homeSocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.homeAssignment!);
```

### Existing: isProcessing mutex pattern (replicate in LINEUP_SWAP + LINEUP_CONFIRM)

```typescript
// Source: packages/server/src/roomHandlers.ts — UNIFORM_CONFIRM handler [VERIFIED: codebase]
if (room.isProcessing) return;
room.isProcessing = true;
try {
  // ... handler logic ...
} finally {
  room.isProcessing = false;
}
```

### Existing: App.tsx socket handler registration pattern

```typescript
// Source: packages/client/src/App.tsx — lines 81-142 [VERIFIED: codebase]
// Every socket.on() in useEffect must have a matching socket.off() in the cleanup return
function onBothFormationsConfirmed(...) { ... }
socket.on(ServerEvents.BOTH_FORMATIONS_CONFIRMED, onBothFormationsConfirmed);
return () => {
  socket.off(ServerEvents.BOTH_FORMATIONS_CONFIRMED, onBothFormationsConfirmed);
};
```

### Existing: PlayerStatsPanel STAT_LABELS (to be exported)

```typescript
// Source: packages/client/src/components/PlayerStatsPanel.tsx — line 11 [VERIFIED: codebase]
// Currently: const STAT_LABELS — change to: export const STAT_LABELS
const STAT_LABELS: Array<[keyof PlayerPiece, string]> = [
  ['pace', 'Pace'],
  ['shooting', 'Shooting'],
  ['tackling', 'Tackling'],
  ['dribbling', 'Dribbling'],
  ['saving', 'Saving'],
  ['handling', 'Handling'],
  ['resilience', 'Resilience'],
  ['aerialAbility', 'Aerial'],
  ['highPass', 'High Pass'],
];
```

---

## State of the Art

| Old Approach                                                                    | Current Approach                                                            | When Changed | Impact                                                           |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `buildInitialGameState` called immediately after both formations confirmed      | Deferred to after both players confirm lineup (`LINEUP_CONFIRM` both fired) | Phase 24     | Adds lineup assignment and swap step before game start           |
| Squad ordering from `getSquadPlayers` (implicit, array filter order)            | Explicit confirmed ordering from auto-assignment + optional player swaps    | Phase 24     | Players now control which squad member fills each formation slot |
| `Screen` union: `'LANDING' \| 'CREATE_ROOM' \| ... \| 'GAME_BOARD' \| 'REPLAY'` | Add `'LINEUP_ASSIGNMENT'`                                                   | Phase 24     | New pre-game screen between formation confirm and game board     |

**Deprecated/outdated after Phase 24:**

- `formationsLocked` state in App.tsx — placeholder signal replaced by `'LINEUP_ASSIGNMENT'` screen routing
- Placeholder render branch `screen === 'UNIFORM_SELECTION' && formationsLocked` — deleted

---

## Assumptions Log

| #   | Claim                                                                                                                         | Section                                       | Risk if Wrong                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A1  | FWD-wing scoring applies +3 bonus to `role === 'ST'` as well as `role === 'FWD'` (both are forward-oriented roles)            | Architecture Patterns — computeAutoAssignment | Strikers would score lower for FWD-wing slots than intended; wrong assignment output                                  |
| A2  | Post-goal `buildKickOffPieces` should NOT honor the confirmed player-slot assignment — it resets to default formation mapping | Common Pitfalls — Pitfall 8                   | If players expect their assigned lineup to be preserved after goals, pieces would appear at wrong positions post-goal |
| A3  | `LINEUP_ASSIGNMENT_READY` does not need to be re-emitted on player reconnect during the lineup phase (v1.3 gap accepted)      | Architecture Patterns — Pattern 2             | Player reconnecting during lineup would get stuck on a blank screen                                                   |

**If this table is empty:** n/a — three assumptions identified above.

---

## Open Questions (RESOLVED)

1. **FWD bonus for ST role in FWD-wing scoring (A1)**
   - What we know: D-04 says `(3 if role=FWD)` for FWD-wing; `PoolPlayer.role` has both `'FWD'` and `'ST'` as distinct values
   - What's unclear: Whether ST-role players should receive the FWD-wing +3 bonus
   - RESOLVED: ST does not receive the FWD-wing +3 bonus — D-04 is treated literally (`role === 'FWD'` only). Strikers are pulled central by the FWD-central +4 bonus instead. See Plan 02 Task 2 action.

2. **Post-goal piece reset and confirmed lineup order (A2)**
   - What we know: `buildKickOffPieces` is called after each goal; it currently uses `getSquadPlayers` order
   - What's unclear: Whether the confirmed player-slot assignment should persist across goals
   - RESOLVED: Post-goal resets use `getSquadPlayers` default ordering (v1.3 gap accepted). `buildKickOffPieces` is not modified in this phase. See Plan 02 Task 3 pitfall guard.

3. **Reconnect handling during lineup phase (A3)**
   - What we know: The disconnect/reconnect grace period is 90 seconds; `broadcastState` re-emits `GAME_STATE` on reconnect
   - What's unclear: Whether `LINEUP_ASSIGNMENT_READY` is re-emitted on reconnect
   - RESOLVED: Reconnect during lineup is an accepted v1.3 gap — no `LINEUP_ASSIGNMENT_READY` re-emit on reconnect in this phase.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `packages/server/src/roomHandlers.ts` — UNIFORM_CONFIRM handler structure, away-confirm branch, per-socket emit pattern, isProcessing mutex pattern [VERIFIED: codebase]
- Codebase: `packages/server/src/gameEngine.ts` — `buildSquadPieces`, `buildInitialGameState`, `buildKickOffPieces` signatures and behavior [VERIFIED: codebase]
- Codebase: `packages/server/src/roomStore.ts` — Room type structure, existing optional fields pattern [VERIFIED: codebase]
- Codebase: `packages/shared/src/events.ts` — Event const objects, typed interface pattern, existing events [VERIFIED: codebase]
- Codebase: `packages/shared/src/formations.ts` — `FormationId`, `SlotRole`, `FormationSlot`, `FORMATIONS` registry, slot index 0 = GK [VERIFIED: codebase]
- Codebase: `packages/shared/src/teams.ts` / `teamConfig.ts` — `PoolPlayer` interface, `PLAYER_POOL`, `getSquadPlayers` [VERIFIED: codebase]
- Codebase: `packages/client/src/App.tsx` — socket handler registration pattern, screen routing, formationsLocked state [VERIFIED: codebase]
- Codebase: `packages/client/src/store/useGameStore.ts` — Screen union, Zustand pattern [VERIFIED: codebase]
- Codebase: `packages/client/src/components/PlayerStatsPanel.tsx` — STAT_LABELS, MiniTokenBadge pattern [VERIFIED: codebase]
- Codebase: `packages/server/vitest.config.ts` + test suite run — framework confirmed, 506 tests passing [VERIFIED: codebase]
- CONTEXT.md: Phase 24 decisions D-01 through D-25 — all locked algorithm and UX decisions [CITED: .planning/phases/24-auto-assignment-lineup/24-CONTEXT.md]
- UI-SPEC.md: Phase 24 UI design contract — CSS values, component props, spacing tokens, interaction contract [CITED: .planning/phases/24-auto-assignment-lineup/24-UI-SPEC.md]

### Secondary (MEDIUM confidence)

- HTML5 Drag and Drop API behavior (`onDragOver` must call `e.preventDefault()` for drop to fire) [ASSUMED] — standard browser behavior; no codebase reference since D&D is new in Phase 24

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies; existing stack verified in codebase
- Algorithm design: HIGH — all scoring formulas, priority order, and tie-breaking are locked in CONTEXT.md decisions
- Server flow restructuring: HIGH — restructuring target code verified in roomHandlers.ts; new event pattern matches existing patterns exactly
- Client component: HIGH — UI-SPEC.md provides exact CSS values; component structure follows established patterns (UniformSelectionScreen, PlayerStatsPanel)
- HTML5 D&D: MEDIUM — standard API; no existing usage in codebase to reference

**Research date:** 2026-07-10
**Valid until:** 2026-08-10 (stable stack; valid until Phase 25)
