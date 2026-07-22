# Phase 29: Draft UI + Pick-and-Swap Flow - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 12 (new + modified)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File                                                                                                                              | Role                              | Data Flow                                 | Closest Analog                                                                                                                                    | Match Quality                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/shared/src/events.ts` (+`DRAFT_PICK`, `DRAFT_STATE_UPDATED`)                                                                         | config/event-contract             | request-response                          | `LINEUP_SWAP`/`LINEUP_ASSIGNMENT_UPDATED` block (lines 77, 120, 209, 268)                                                                         | exact                                                     |
| `packages/shared/src/types.ts` (+`DraftSessionState`/`DraftPickPayload`)                                                                       | model                             | transform                                 | `TeamType`/`DraftPoolId`/`PACK_COMPOSITION` block (lines 446-501)                                                                                 | exact                                                     |
| `packages/server/src/roomStore.ts` (`Room` +`draftSession?`)                                                                                   | model                             | CRUD                                      | existing `Room` type fields (`homeAssignment`, `homeLineupConfirmed`, etc.)                                                                       | exact                                                     |
| `packages/server/src/draftSession.ts` (NEW)                                                                                                    | service (pure state-machine)      | transform/event-driven                    | `packages/server/src/gameEngine.ts` (`scoreForRole`/`pickBest`/`computeAutoAssignment`, lines 117-230)                                            | role-match (pure, testable, separated from socket wiring) |
| `packages/server/src/roomHandlers.ts` (`ROOM_SETTINGS_CONFIRM` +pack-gen, `UNIFORM_CONFIRM` away-branch +draft gate, new `DRAFT_PICK` handler) | controller (socket handler)       | request-response / event-driven           | `LINEUP_SWAP` handler (lines 552-610) + `UNIFORM_CONFIRM` away-branch (lines 496-544) + `ROOM_SETTINGS_CONFIRM` (lines 336-427)                   | exact                                                     |
| `packages/server/src/createServer.ts` (reconnect block extension)                                                                              | middleware (connection lifecycle) | event-driven                              | existing reconnect block (lines ~91-150, `room.gameState !== null` re-emit gate)                                                                  | role-match (extends existing incomplete pattern)          |
| `packages/client/src/components/LineupAssignmentScreen.tsx` (extended: `draftMode` prop, wires `DRAFT_PICK`)                                   | component                         | request-response / drag-drop event-driven | itself (existing `handleDragStart/Over/Drop/End`, lines 202-232; `LineupStatCard`, lines 65-142)                                                  | exact (self-extension)                                    |
| `packages/client/src/components/LineupAssignmentScreen.module.css` (+tier border classes, carousel row styles)                                 | config (styles)                   | —                                         | itself (`.statCardBase`/`.statCard`/`.benchSlot`/`.swapRejection`, lines 126-165, 295-311)                                                        | exact                                                     |
| `packages/client/src/components/DraftPackCarousel.tsx` (NEW)                                                                                   | component                         | streaming/carousel UI, drag-source only   | `LineupStatCard` inline component (lines 65-142) for card shape; no carousel precedent exists — new UI primitive                                  | role-match (card body reused, nav behavior is new)        |
| `packages/client/src/components/BenchCarousel.tsx` (NEW, or inlined)                                                                           | component                         | CRUD (dynamic list) / drag-drop           | `LineupAssignmentScreen.tsx`'s bench placeholder block (lines 283-291) + `LineupStatCard`                                                         | role-match (structural placeholder → real data binding)   |
| `packages/server/src/draftSession.test.ts` (NEW)                                                                                               | test (unit)                       | transform                                 | none direct — model on `gameEngine.ts`'s pure-function unit-test style (not read this session; infer from `draftPacks.test.ts` naming convention) | role-match                                                |
| `packages/server/src/__tests__/draftSession.integration.test.ts` (NEW)                                                                         | test (integration, socket)        | event-driven                              | `packages/server/src/__tests__/lineupAssignment.integration.test.ts` (full file, 90+ lines read)                                                  | exact                                                     |
| `packages/client/src/App.tsx` (routing: pass `draftMode`/`teamType` through to `LineupAssignmentScreen`)                                       | component (routing)               | request-response                          | existing `onLineupAssignmentReady`/`handleLineupSwap`/`handleLineupConfirm` wiring                                                                | exact                                                     |

## Pattern Assignments

### `packages/shared/src/events.ts` (config, request-response)

**Analog:** `LINEUP_SWAP` / `LINEUP_ASSIGNMENT_UPDATED` (lines 77, 120, 209, 268)

**Naming/payload pattern** (verified in file):

```typescript
LINEUP_SWAP: 'lineup:swap',
LINEUP_ASSIGNMENT_UPDATED: 'lineup:assignment-updated',

[ClientEvents.LINEUP_SWAP]: (payload: { slotIndexA: number; slotIndexB: number }) => void;
[ServerEvents.LINEUP_ASSIGNMENT_UPDATED]: (assignment: string[]) => void;
```

Apply identically for the new events (verb:noun string, past-tense server→client name, object payload for client→server):

```typescript
DRAFT_PICK: 'draft:pick',
DRAFT_STATE_UPDATED: 'draft:state-updated',

[ClientEvents.DRAFT_PICK]: (payload: {
  cardId: string;
  destination: { type: 'slot'; slotIndex: number } | { type: 'bench' };
}) => void;
[ServerEvents.DRAFT_STATE_UPDATED]: (state: DraftClientView) => void;
```

---

### `packages/server/src/roomHandlers.ts` — `ROOM_SETTINGS_CONFIRM` (controller, request-response)

**Analog:** existing handler body, lines 336-427 (full read)

**Core pattern to extend** (insert immediately after the lock-in lines, before `io.to(roomCode).emit(ROOM_SETTINGS_CONFIRMED, ...)`):

```typescript
// Store settings and lock. (existing, lines 407-411)
room.gameSpeed = speed;
room.teamType = teamType;
room.draftPools = teamType === 'draft' ? draftPools : [];
room.settingsConfirmed = true;

// NEW: Phase 29 draft-pack generation trigger point (forward-pointer already left in
// packages/server/src/draftPacks.ts) — generateMatchPacks(draftPools) + independent
// crypto.randomInt shuffle of the 8 pack indices (D-04), NOT a fixed [0-3]/[4-7] split.
if (teamType === 'draft') {
  const { packs } = generateMatchPacks(draftPools);
  const shuffledIdx = shuffle([0, 1, 2, 3, 4, 5, 6, 7], randomInt); // crypto.randomInt-bound
  room.draftSession = {
    draftPacks: packs,
    homePackOrder: shuffledIdx.slice(0, 4),
    awayPackOrder: shuffledIdx.slice(4, 8),
    cycle: 0,
    // ...remaining fields initialized empty/false, see roomStore.ts extension below
  };
}
```

**Allow-list validation pattern already present** (reuse verbatim for any new validated field):

```typescript
if (!(VALID_TEAM_TYPES as readonly string[]).includes(teamType)) {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TEAM_TYPE');
  return;
}
```

---

### `packages/server/src/roomHandlers.ts` — `UNIFORM_CONFIRM` away-branch (controller, request-response) — CRITICAL GATE

**Analog:** existing away-branch, lines 496-544 (full read)

**Current unconditional logic that MUST be gated** (Pitfall 2 in RESEARCH.md):

```typescript
// Phase 24 ASSIGN-01: compute auto-assignment for each team.
const homeSquad = getSquadPlayers(room.homePickedTeam!);
const awaySquad = getSquadPlayers(teamId);
room.homeAssignment = computeAutoAssignment(
  homeSquad,
  FORMATIONS[room.homePickedFormation!].slots,
).map((p) => p.id);
room.awayAssignment = computeAutoAssignment(awaySquad, FORMATIONS[formationId].slots).map(
  (p) => p.id,
);

io.to(roomCode).emit(
  ServerEvents.BOTH_FORMATIONS_CONFIRMED,
  room.homePickedFormation!,
  formationId,
);

const homeSocket = io.sockets.sockets.get(room.players[0]!.socketId);
const awaySocket = io.sockets.sockets.get(room.players[1]!.socketId);
homeSocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.homeAssignment);
awaySocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.awayAssignment);
```

**Required insertion point:** wrap the `computeAutoAssignment` calls in `if (room.teamType === 'draft') { /* empty assignment array; open first pack; emit initial DRAFT_STATE_UPDATED */ } else { /* existing computeAutoAssignment path verbatim */ }`. The `BOTH_FORMATIONS_CONFIRMED` broadcast and per-socket-private-emit pattern below it stays IDENTICAL for both branches (only the assignment content differs — draft mode sends `Array(11).fill(null)` plus the first-cycle pack contents via `DRAFT_STATE_UPDATED`).

**Per-socket privacy pattern to reuse verbatim for `DRAFT_STATE_UPDATED`:**

```typescript
const homeSocket = io.sockets.sockets.get(room.players[0]!.socketId);
const awaySocket = io.sockets.sockets.get(room.players[1]!.socketId);
homeSocket?.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room, 'home'));
awaySocket?.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room, 'away'));
```

Never `io.to(roomCode).emit(...)` for this event — leaks opponent's pack contents (D-14).

---

### `packages/server/src/roomHandlers.ts` — new `DRAFT_PICK` handler (controller, event-driven)

**Analog:** `LINEUP_SWAP` handler, lines 552-610 (full read) — isProcessing mutex, spoofing guard, allow-list validation, single-socket-private response.

**Full structural template to copy:**

```typescript
socket.on(ClientEvents.LINEUP_SWAP, (payload: { slotIndexA: number; slotIndexB: number }) => {
  const roomCode = socket.data.roomCode;
  if (roomCode === undefined) return;

  const room = getRoom(roomCode);
  if (!room) return;

  // SC-5 / mutex: drop concurrent events.
  if (room.isProcessing) return;
  room.isProcessing = true;
  try {
    const { slotIndexA, slotIndexB } = payload;

    // Determine which assignment array this player may mutate (T-24-03 spoofing guard).
    const playerSlot = socket.data.playerSlot;
    const assignment = playerSlot === 1 ? room.homeAssignment : room.awayAssignment;

    if (!assignment) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      return;
    }

    // ...allow-list / range validation...

    // ...perform mutation in place...

    // Emit updated assignment to the requesting socket only (D-12 privacy).
    socket.emit(ServerEvents.LINEUP_ASSIGNMENT_UPDATED, assignment);
  } finally {
    room.isProcessing = false;
  }
});
```

**Apply for `DRAFT_PICK`:**

- Same `roomCode`/`room` lookup, same `if (room.isProcessing) return; room.isProcessing = true; try { ... } finally { room.isProcessing = false; }` mutex wrap.
- Same spoofing guard idiom: resolve `playerSlot` from `socket.data.playerSlot`, NEVER from any client payload field — validate `cardId` against `room.draftSession.{home,away}CurrentPack` server-side state (never trust client-echoed pack contents; ASVS V4/V5, per RESEARCH.md Known Threat Patterns table).
- Unlike `LINEUP_SWAP` (single-socket-private response), `DRAFT_PICK` resolution after a mutual-wait gate advance must emit to BOTH sockets individually (see Pattern 2 above) since both players' pack contents can change on a swap/new-pack transition — this is the one structural difference from the `LINEUP_SWAP` template.

---

### `packages/server/src/roomHandlers.ts` — mutual-wait gate (shared pattern, see Shared Patterns below)

**Analog:** `LINEUP_CONFIRM` handler, lines 613-686 (home/away flag pattern, referenced in RESEARCH.md verbatim)

```typescript
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

---

### `packages/server/src/draftPacks.ts` (UNCHANGED, consumed as-is)

**Full file already read (27 lines):**

```typescript
import { randomInt } from 'crypto';
import { generateDraftPacks } from '@counter-attack/shared';
import type { DraftPoolId, DraftPack, TieredPoolPlayer } from '@counter-attack/shared';

export function generateMatchPacks(selectedPools: DraftPoolId[]): {
  pool: TieredPoolPlayer[];
  packs: DraftPack[];
} {
  return generateDraftPacks(selectedPools, randomInt);
}
```

Import this directly into `roomHandlers.ts` and (indirectly) `draftSession.ts`. Do not re-implement pack generation. Note the file's own forward-pointer comment names Phase 29's `ROOM_SETTINGS_CONFIRM` handler as the intended call site — confirms Pattern/A2 in RESEARCH.md.

---

### `packages/server/src/draftSession.ts` (NEW — pure state-machine module)

**Analog (structural separation convention):** `packages/server/src/gameEngine.ts` — pure, side-effect-free functions (`scoreForRole`, `pickBest`, `computeAutoAssignment`) kept separate from `roomHandlers.ts` socket wiring, imported and called from the handler. Mirror this exact separation for `draftSession.ts`: export pure functions like `advanceSubStep(session): DraftSession`, `checkKeeperSafety(session, playerSlot): DraftSession`, `assignBenchNumbers(benchIds, rng): Record<string, number>` — no `io`/`socket` references inside this file, so it is independently unit-testable (matches Wave 0 gap: `draftSession.test.ts`).

---

### `packages/client/src/components/LineupAssignmentScreen.tsx` (component, drag-drop event-driven)

**Analog:** itself — full file read (313 lines).

**Imports pattern** (lines 10-17):

```typescript
import { useState, useEffect } from 'react';
import { FORMATIONS, PLAYER_POOL } from '@counter-attack/shared';
import type { FormationId, FormationSlot, PoolPlayer, TeamId } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { TeamBadge } from './TeamBadge.js';
import { NationFlag } from './NationFlag.js';
import { STAT_LABELS } from './PlayerStatsPanel.js';
import styles from './LineupAssignmentScreen.module.css';
```

**Drag-and-drop core pattern** (lines 202-232) — reuse verbatim for lineup↔bench, extend for row→lineup/row→bench:

```typescript
function handleDragStart(e: React.DragEvent<HTMLDivElement>, idx: number) {
  setDragSourceIndex(idx);
  e.dataTransfer.setData('text/plain', String(idx));
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e: React.DragEvent<HTMLDivElement>, idx: number) {
  // D-20/Pitfall 3: GK slot (index 0) is never a valid drop target
  if (idx === 0) return;
  e.preventDefault();
  setDropTargetIndex(idx);
}

function handleDrop(e: React.DragEvent<HTMLDivElement>, targetIdx: number) {
  e.preventDefault();
  const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (targetIdx !== 0 && sourceIdx !== targetIdx) {
    onSwap(sourceIdx, targetIdx);
  }
  setDragSourceIndex(null);
  setDropTargetIndex(null);
}
```

**GK-lock extension required (Pitfall 4 / D-09):** the `idx === 0` early-return only blocks non-GK cards being dropped ONTO the GK slot. Add the reverse check — a GK card dropped onto a non-GK slot must also be rejected. Needs access to each card's `role`/`slotRole` at both drag-start and drop time (currently the handler only tracks `idx`, not role — must be extended to carry role info, e.g. via a ref/lookup map keyed by `dragSourceIndex`).

**Error-message local-state pattern** (lines 163-172) — reuse verbatim for the new GK-reverse-rejection message and any `DRAFT_PICK`-rejection message:

```typescript
const gameError = useGameStore((s) => s.gameError);
const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

useEffect(() => {
  if (gameError === 'GK_SLOT_LOCKED') {
    setRejectionMessage('Swap rejected — GK cannot be moved.');
    const timer = setTimeout(() => setRejectionMessage(null), 2000);
    return () => clearTimeout(timer);
  }
}, [gameError]);
```

**Card component base to reuse for `DraftPackCarousel`/`BenchCarousel`** (lines 65-142, `LineupStatCard`) — same `TeamBadge`/`cardBody`/`cardHeader`/`statGrid` structure; add tier-color border via a new `data-tier` attribute or class, per D-19 (`3px solid {tier color}` replacing the existing `1px solid #0f3460`).

**Bench placeholder block to replace with real data** (lines 283-291):

```jsx
<div className={styles.benchSection}>
  <span className={styles.benchLabel}>BENCH</span>
  <div className={styles.benchPlaceholders}>
    {[0, 1, 2, 3, 4].map((i) => (
      <div key={i} className={styles.benchSlot} data-bench-index={i} />
    ))}
  </div>
</div>
```

Replace the fixed `[0,1,2,3,4]` map with `benchCardIds.map(...)` (dynamic length, D-09) rendering real `LineupStatCard`/carousel-style cards.

---

### `packages/client/src/components/LineupAssignmentScreen.module.css` (config, styles)

**Analog:** itself — relevant class names confirmed via grep: `.statusActive`/`.statusWaiting` (32, 40), `.confirmButtonGreen` (60), `.statCardBase`/`.statCard`/`.statCardLocked`/`.statCardConfirmed`/`.statCardDragging`/`.statCardDropTarget` (126-165), `.benchSlot` (295), `.swapRejection` (305).

**Pattern:** add new classes following the existing `composes: statCardBase;` convention for tier-border variants:

```css
.statCard {
  composes: statCardBase;
  /* existing 1px solid #0f3460 border */
}
/* NEW, this phase */
.cardTierChase {
  composes: statCardBase;
  border: 3px solid #f5c518;
}
.cardTierRare {
  composes: statCardBase;
  border: 3px solid #c0c0c0;
}
.cardTierUncommon {
  composes: statCardBase;
  border: 3px solid #cd7f32;
}
.cardTierCommon {
  composes: statCardBase;
  border: 3px solid #3b82f6;
}
.cardTierKeeper {
  composes: statCardBase;
  border: 3px solid #22c55e;
}
```

Carousel row/track styles should reuse the existing dark-theme surface tokens already declared at the top of this file (`#1a1a2e` background, `#16213e` surface, `#0f3460` border) — do not introduce a new base palette.

---

### `packages/server/src/__tests__/draftSession.integration.test.ts` (NEW test, integration)

**Analog:** `packages/server/src/__tests__/lineupAssignment.integration.test.ts` (full harness read, 90+ lines)

**Server lifecycle + client harness pattern to copy verbatim:**

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms } from '../roomStore.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import type { ClientToServerEvents, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';

let httpServer: ReturnType<typeof buildServer>['httpServer'];
let address: string;
const connectedClients: Socket[] = [];

beforeEach(async () => {
  const server = buildServer();
  httpServer = server.httpServer;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  const addr = httpServer.address() as { port: number };
  address = `http://localhost:${addr.port}`;
});

afterEach(async () => {
  for (const client of connectedClients) {
    if (client.connected) client.disconnect();
  }
  connectedClients.length = 0;
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  clearAllRooms();
});

function createClient(opts?: {
  auth?: { sessionToken?: string };
}): Socket<ServerToClientEvents, ClientToServerEvents> {
  const client = ioClient(address, {
    transports: ['websocket'],
    forceNew: true,
    auth: opts?.auth ?? {},
  }) as Socket<ServerToClientEvents, ClientToServerEvents>;
  connectedClients.push(client);
  return client;
}

function oncePromise<E extends keyof ServerToClientEvents>(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  event: E,
  timeoutMs = 1500,
): Promise<Parameters<ServerToClientEvents[E]>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error(`Timed out waiting for event "${String(event)}" after ${timeoutMs}ms`)),
      timeoutMs,
    );
    (socket as any).once(event, (...args: unknown[]) => {
      clearTimeout(timer);
      resolve(args as Parameters<ServerToClientEvents[E]>);
    });
  });
}
```

Use `confirmDefaultRoomSettings` test helper (extend it to accept `teamType: 'draft'` + `draftPools` if not already parameterized) to drive both players through settings/team/uniform confirm up to the draft screen, then drive `DRAFT_PICK` events and assert `DRAFT_STATE_UPDATED` payloads per-socket, mirroring the existing assertions for `LINEUP_ASSIGNMENT_READY`/`LINEUP_ASSIGNMENT_UPDATED`/`GAME_STATE`.

---

## Shared Patterns

### Server-authoritative mutual-wait gate

**Source:** `packages/server/src/roomHandlers.ts` `LINEUP_CONFIRM` handler (lines 613-686), `ROOM_SETTINGS_CONFIRM`'s home/away sequencing
**Apply to:** every `DRAFT_PICK` sub-step boundary (PICK1→SWAP, PICK2→SWAP_BACK, PICK3→NEW_PACK/cycle-advance)

```typescript
if (playerSlot === 1) {
  room.draftSession.homePickedThisSubStep = true;
} else {
  room.draftSession.awayPickedThisSubStep = true;
}
if (!room.draftSession.homePickedThisSubStep || !room.draftSession.awayPickedThisSubStep) return;
// both true — advance sub-step, reset both flags to false
```

### Per-socket private state delivery

**Source:** `packages/server/src/roomHandlers.ts` `UNIFORM_CONFIRM` away-branch (lines 540-543), `LINEUP_SWAP` (line 606)
**Apply to:** every `DRAFT_STATE_UPDATED` emission — NEVER `io.to(roomCode).emit(...)` for pack contents

```typescript
const homeSocket = io.sockets.sockets.get(room.players[0]!.socketId);
const awaySocket = io.sockets.sockets.get(room.players[1]!.socketId);
homeSocket?.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room, 'home'));
awaySocket?.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room, 'away'));
```

### isProcessing mutex on every stateful handler

**Source:** `LINEUP_SWAP` (lines 566-609), `UNIFORM_CONFIRM` (lines 454-546), noted project-wide convention
**Apply to:** `DRAFT_PICK` handler body

```typescript
if (room.isProcessing) return;
room.isProcessing = true;
try {
  // ...validation + mutation...
} finally {
  room.isProcessing = false;
}
```

### crypto.randomInt for all gameplay/fairness randomness

**Source:** `packages/server/src/draftPacks.ts` (`import { randomInt } from 'crypto'`)
**Apply to:** pack→player random assignment (D-04) and bench random-number assignment (D-15) — never `Math.random()`.

### Allow-list validation + GAME_ERROR reason strings

**Source:** `ROOM_SETTINGS_CONFIRM` (lines 372-404), `LINEUP_SWAP` (lines 582-598)
**Apply to:** `DRAFT_PICK`'s `cardId`/`destination.slotIndex` validation

```typescript
if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 10) {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SLOT_INDEX');
  return;
}
```

### Local (non-Zustand) drag state

**Source:** `LineupAssignmentScreen.tsx` lines 159-161 (`useState` for `dragSourceIndex`/`dropTargetIndex`)
**Apply to:** `DraftPackCarousel`/`BenchCarousel` drag state — never store transient drag position in Zustand (project convention, Pitfall 7 referenced in RESEARCH.md).

## No Analog Found

| File                                                                                                                                                                 | Role       | Data Flow    | Reason                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/client/src/components/DraftPackCarousel.tsx` (carousel nav mechanics specifically — left/right button scroll, tier-sort-to-left, reset-scroll-on-new-pack) | component  | streaming UI | No carousel/standalone `PlayerCard` component exists anywhere in the client (confirmed in RESEARCH.md "Established Patterns"); only the card body (`LineupStatCard`) has a direct analog — nav chrome is genuinely new. Build using plain scroll/flex + `‹`/`›` unicode nav buttons per UI-SPEC, no new library.                                                               |
| `packages/server/src/createServer.ts` reconnect extension for pre-gameState draft resync                                                                             | middleware | event-driven | The existing reconnect block only handles `room.gameState !== null`; there is no existing pattern for resending pre-gameState phase data (Pitfall 3) — this is a new code path, not an extension of a working analog. Model the shape on the existing `GAME_STATE` re-emit block but there is no pre-existing "resend private draft view on reconnect" precedent to copy from. |

## Metadata

**Analog search scope:** `packages/server/src/roomHandlers.ts`, `packages/server/src/draftPacks.ts`, `packages/server/src/roomStore.ts`, `packages/server/src/gameEngine.ts`, `packages/server/src/createServer.ts`, `packages/server/src/__tests__/lineupAssignment.integration.test.ts`, `packages/client/src/components/LineupAssignmentScreen.tsx` + `.module.css`, `packages/shared/src/events.ts`, `packages/shared/src/types.ts`, `packages/shared/src/draftEngine.ts`
**Files scanned:** 10 read directly this session (targeted ranges + 2 full-file reads), plus CONTEXT.md/RESEARCH.md/UI-SPEC.md's own extensive prior-session file citations (accepted as verified per RESEARCH.md's "Primary (HIGH confidence — direct codebase reads this session)" sourcing)
**Pattern extraction date:** 2026-07-21
