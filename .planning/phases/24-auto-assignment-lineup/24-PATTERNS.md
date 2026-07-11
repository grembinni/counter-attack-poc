# Phase 24: Auto-Assignment & Lineup - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 10
**Analogs found:** 9 / 10

## File Classification

| New/Modified File                                                        | Role                     | Data Flow        | Closest Analog                                                               | Match Quality |
| ------------------------------------------------------------------------ | ------------------------ | ---------------- | ---------------------------------------------------------------------------- | ------------- |
| `packages/server/src/gameEngine.ts` (modify)                             | service                  | CRUD             | `packages/server/src/gameEngine.ts` itself (signature extension)             | self          |
| `packages/server/src/roomHandlers.ts` (modify)                           | middleware/event-handler | event-driven     | `packages/server/src/roomHandlers.ts` UNIFORM_CONFIRM handler                | self          |
| `packages/server/src/roomStore.ts` (modify)                              | model                    | CRUD             | `packages/server/src/roomStore.ts` itself (field additions)                  | self          |
| `packages/shared/src/events.ts` (modify)                                 | config                   | event-driven     | `packages/shared/src/events.ts` existing BOTH_FORMATIONS_CONFIRMED additions | self          |
| `packages/client/src/App.tsx` (modify)                                   | controller               | event-driven     | `packages/client/src/App.tsx` BOTH_FORMATIONS_CONFIRMED handler              | self          |
| `packages/client/src/store/useGameStore.ts` (modify)                     | store                    | request-response | `packages/client/src/store/useGameStore.ts` Screen union                     | self          |
| `packages/client/src/components/LineupAssignmentScreen.tsx` (new)        | component                | request-response | `packages/client/src/components/UniformSelectionScreen.tsx`                  | exact         |
| `packages/client/src/components/LineupAssignmentScreen.module.css` (new) | config                   | —                | `packages/client/src/components/UniformSelectionScreen.module.css`           | role-match    |
| `packages/client/src/components/PlayerStatsPanel.tsx` (modify)           | component                | request-response | self (export STAT_LABELS)                                                    | self          |
| `packages/server/src/__tests__/gameEngine.phase24.test.ts` (new)         | test                     | CRUD             | existing server `__tests__/*.test.ts`                                        | role-match    |

---

## Pattern Assignments

### `packages/server/src/gameEngine.ts` — `computeAutoAssignment` (new export)

**Analog:** Self — extends the file's existing pure-function pattern (`buildSquadPieces`, `applyFreeMoveZoneCheck`).

**Imports pattern** (lines 1–20, existing top of file): Copy existing import block — add `FormationSlot`, `SlotRole` from `@counter-attack/shared` if not already imported.

**Core pattern — `buildSquadPieces` (lines 115–159):**

```typescript
function buildSquadPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
  selectedFormation: { home: FormationId; away: FormationId },
): PlayerPiece[] {
  const homeSlots = FORMATIONS[selectedFormation.home].slots;
  const homeSquad = getSquadPlayers(selectedTeams.home).map((p, i) => ({
    ...p,
    teamId: 'home' as const,
    id: `home-${i}`,
    position: { ...homeSlots[i]!.position },
    number: homeSlots[i]!.jerseyNumber,
  }));
  // ...
}
```

**Signature change for `buildSquadPieces`:** Add optional `confirmedHomeOrder?: PoolPlayer[]` and `confirmedAwayOrder?: PoolPlayer[]` parameters. Use `confirmedHomeOrder ?? getSquadPlayers(selectedTeams.home)` in the mapping. `buildInitialGameState` gains the same optional parameters and threads them through.

**New `computeAutoAssignment` export pattern:** Pure function, no side effects — mirror the pure-function style of existing helpers. Export it explicitly for unit testing:

```typescript
export function computeAutoAssignment(
  squad: PoolPlayer[],
  slots: readonly FormationSlot[],
): PoolPlayer[] { ... }
```

Three-pass: GK lock → anchor roles → flex roles. Implementation fully specified in RESEARCH.md Pattern 1.

---

### `packages/server/src/roomHandlers.ts` — restructure away-confirm + add LINEUP_SWAP + LINEUP_CONFIRM

**Analog:** The existing `UNIFORM_CONFIRM` handler (lines 300–405).

**isProcessing mutex pattern** (lines 310–312 and 401–403):

```typescript
if (room.isProcessing) return;
room.isProcessing = true;
try {
  // ... handler logic ...
} finally {
  room.isProcessing = false;
}
```

Apply this exact pattern to both `LINEUP_SWAP` and `LINEUP_CONFIRM` handlers.

**GAME_ERROR emit pattern** (line 315):

```typescript
socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TEAM');
return;
```

Use same pattern for `GK_SLOT_LOCKED`, `WRONG_PHASE`, `INVALID_SLOT_INDEX` errors.

**playerSlot validation pattern** (lines 332–339):

```typescript
const playerSlot = socket.data.playerSlot;
if (playerSlot !== 1) {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
  return;
}
```

For LINEUP_SWAP/LINEUP_CONFIRM, use `playerSlot` to gate which team's assignment the player may mutate (slot 1 = home, slot 2 = away). Do NOT copy the sequential home-first gate — LINEUP_CONFIRM is parallel.

**Per-socket emit to a specific socket** (referenced in RESEARCH.md Pattern 6, mirrors existing GAME_ERROR emit pattern):

```typescript
const homeSocket = io.sockets.sockets.get(room.players[0]!.socketId);
const awaySocket = io.sockets.sockets.get(room.players[1]!.socketId);
homeSocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.homeAssignment!);
awaySocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.awayAssignment!);
```

**Restructure target (lines 363–399 — away-confirm branch):** Remove `buildInitialGameState` call, `room.gameState = gameState`, and `broadcastState(io, room)`. Insert `computeAutoAssignment` calls, store assignments in room, emit `LINEUP_ASSIGNMENT_READY` to each socket individually. Keep `io.to(roomCode).emit(ServerEvents.BOTH_FORMATIONS_CONFIRMED, ...)`.

**Both-players-confirmed gate** (copy pattern from `readyPlayers` in KICK_OFF_SETUP — see roomStore):

```typescript
if (room.homeLineupConfirmed && room.awayLineupConfirmed) {
  // resolve PoolPlayer[], call buildInitialGameState, broadcastState
}
```

---

### `packages/server/src/roomStore.ts` — Room type field additions

**Analog:** Existing optional field pattern (lines 57–115):

```typescript
/**
 * Phase 24: Auto-assignment result for home team. PlayerId[] (11 entries).
 * Set in UNIFORM_CONFIRM away-branch; mutated by LINEUP_SWAP; consumed by LINEUP_CONFIRM.
 */
homeAssignment?: string[] | null;
awayAssignment?: string[] | null;
homeLineupConfirmed?: boolean;
awayLineupConfirmed?: boolean;
```

Follow existing JSDoc comment style (each field has a Phase reference, purpose, and lifecycle note).

---

### `packages/shared/src/events.ts` — four new events

**Analog:** Existing `BOTH_FORMATIONS_CONFIRMED` addition (lines 88–93) and `ClientEvents`/`ServerEvents` const pattern.

**Const object extension pattern** (lines 10–93):

```typescript
export const ClientEvents = {
  // ... existing ...
  LINEUP_SWAP: 'lineup:swap',
  LINEUP_CONFIRM: 'lineup:confirm',
} as const;

export const ServerEvents = {
  // ... existing ...
  LINEUP_ASSIGNMENT_READY: 'lineup:assignment-ready',
  LINEUP_ASSIGNMENT_UPDATED: 'lineup:assignment-updated',
} as const;
```

**Typed interface extension pattern** (lines 99–165):

```typescript
export interface ClientToServerEvents {
  // ... existing ...
  [ClientEvents.LINEUP_SWAP]: (payload: { slotIndexA: number; slotIndexB: number }) => void;
  [ClientEvents.LINEUP_CONFIRM]: (payload: { confirmedOrder: string[] }) => void;
}
export interface ServerToClientEvents {
  // ... existing ...
  [ServerEvents.LINEUP_ASSIGNMENT_READY]: (assignment: string[]) => void;
  [ServerEvents.LINEUP_ASSIGNMENT_UPDATED]: (assignment: string[]) => void;
}
```

Follow the JSDoc comment style of existing entries (Phase reference, payload description).

---

### `packages/client/src/App.tsx` — socket handler additions + screen routing

**Analog:** `onBothFormationsConfirmed` handler pattern (lines 112–114 and 125–141).

**Socket handler registration pattern** (lines 112–142):

```typescript
function onBothFormationsConfirmed(_homeFormation: FormationId, _awayFormation: FormationId) {
  setFormationsLocked(true);
}
socket.on(ServerEvents.BOTH_FORMATIONS_CONFIRMED, onBothFormationsConfirmed);
return () => {
  socket.off(ServerEvents.BOTH_FORMATIONS_CONFIRMED, onBothFormationsConfirmed);
};
```

Every `socket.on` must have a matching `socket.off` in the cleanup return. New handlers:

```typescript
function onLineupAssignmentReady(assignment: string[]) {
  setLineupAssignment(assignment);
  setScreen('LINEUP_ASSIGNMENT');
}
function onLineupAssignmentUpdated(assignment: string[]) {
  setLineupAssignment(assignment);
}
socket.on(ServerEvents.LINEUP_ASSIGNMENT_READY, onLineupAssignmentReady);
socket.on(ServerEvents.LINEUP_ASSIGNMENT_UPDATED, onLineupAssignmentUpdated);
// cleanup:
socket.off(ServerEvents.LINEUP_ASSIGNMENT_READY, onLineupAssignmentReady);
socket.off(ServerEvents.LINEUP_ASSIGNMENT_UPDATED, onLineupAssignmentUpdated);
```

**Local state pattern** (lines 29–36): `lineupAssignment` and `lineupConfirmed` are `useState` in `App.tsx` — NOT in Zustand store (mirrors `homePickedTeam`, `homeConfirmedFormation`):

```typescript
const [lineupAssignment, setLineupAssignment] = useState<string[] | null>(null);
const [lineupConfirmed, setLineupConfirmed] = useState(false);
```

**Screen routing pattern** (lines 169–175):

```typescript
// BEFORE (remove):
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
```

Delete `formationsLocked` state and `setFormationsLocked` after this change (dead code).

**Emit helpers pattern** (lines 157–165):

```typescript
function handleLineupSwap(slotIndexA: number, slotIndexB: number) {
  socket.emit(ClientEvents.LINEUP_SWAP, { slotIndexA, slotIndexB });
}
function handleLineupConfirm(confirmedOrder: string[]) {
  socket.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder });
  setLineupConfirmed(true);
}
```

---

### `packages/client/src/store/useGameStore.ts` — Screen union extension

**Analog:** Existing Screen type (lines 23–31):

```typescript
export type Screen =
  | 'LANDING'
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'WAITING'
  | 'TEAM_SELECTION'
  | 'UNIFORM_SELECTION'
  | 'LINEUP_ASSIGNMENT' // Phase 24: add this entry
  | 'GAME_BOARD'
  | 'REPLAY';
```

Insert `'LINEUP_ASSIGNMENT'` between `'UNIFORM_SELECTION'` and `'GAME_BOARD'` with a Phase 24 comment.

---

### `packages/client/src/components/LineupAssignmentScreen.tsx` (new)

**Analog:** `packages/client/src/components/UniformSelectionScreen.tsx` (entire file).

**Imports pattern** (UniformSelectionScreen lines 11–22):

```typescript
import { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { FORMATIONS, PLAYER_POOL } from '@counter-attack/shared';
import type { FormationId, PoolPlayer } from '@counter-attack/shared';
import { STAT_LABELS } from './PlayerStatsPanel.js'; // export added in PlayerStatsPanel.tsx
import styles from './LineupAssignmentScreen.module.css';
```

**Heading + status messaging pattern** (UniformSelectionScreen lines 178–188):

```tsx
<h2 className={styles.matchSetupHeading}>
  MATCH SETUP: STEP 3 &mdash; {currentPlayerLabel} PLAYER ({youOrOpponent})
</h2>
<p className={isActiveNow ? styles.statusActive : styles.statusWaiting}>
  {isActiveNow
    ? 'Make your selections now!'
    : `Waiting for ${waitingForLabel} Player to Lock in their Selection.`}
</p>
```

Step number is 3 (formation is step 2). Use EXACT same strings. `isActiveNow = !lineupConfirmed` (no sequential lock — both players active in parallel per D-25 corrected).

**Props interface pattern** (UniformSelectionScreen lines 104–122):

```typescript
type Props = {
  assignment: string[]; // PlayerId[] from server (11 entries)
  formationId: FormationId; // this player's chosen formation
  playerSlot: 1 | 2;
  onSwap: (slotIndexA: number, slotIndexB: number) => void;
  onConfirm: (confirmedOrder: string[]) => void;
  lineupConfirmed: boolean;
};
```

**Component local state — drag state only** (no store writes for drag):

```typescript
const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
```

**Confirm button pattern** (UniformSelectionScreen lines 371–386):

```tsx
{
  !lineupConfirmed && (
    <button
      className={styles.confirmButtonGreen}
      onClick={() => {
        onConfirm(assignment);
      }}
    >
      Confirm Lineup
    </button>
  );
}
```

**Layout structure:** 4-column CSS grid (`GK | DEF | MID | FWD`) plus a BENCH row at the bottom. Derive columns by grouping `FORMATIONS[formationId].slots` by `slotRole` line prefix. Bench row has 5 empty placeholder divs, no functional behavior in v1.3.

**HTML5 drag-and-drop per card** (RESEARCH.md Pattern 7):

```tsx
<div
  draggable={slotIndex !== 0 && !lineupConfirmed} // GK (0) never draggable; locked after confirm
  onDragStart={(e) => {
    setDragSourceIndex(slotIndex);
    e.dataTransfer.setData('text/plain', String(slotIndex));
    e.dataTransfer.effectAllowed = 'move';
  }}
  onDragOver={(e) => {
    if (slotIndex === 0) return; // no drop onto GK slot
    e.preventDefault(); // REQUIRED — enables onDrop
    setDropTargetIndex(slotIndex);
  }}
  onDragLeave={() => setDropTargetIndex(null)}
  onDrop={(e) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex !== slotIndex && slotIndex !== 0) {
      onSwap(sourceIndex, slotIndex);
    }
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }}
  onDragEnd={() => {
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }}
/>
```

**Stat card content per slot:** Each card receives `player: PoolPlayer` (resolved from `assignment[i]` via `PLAYER_POOL.find`) and `slotMeta: FormationSlot`. Display `slotMeta.jerseyNumber` (NOT `player.number`). Render all 9 stats using `STAT_LABELS` imported from `PlayerStatsPanel.tsx`.

---

### `packages/client/src/components/PlayerStatsPanel.tsx` — export STAT_LABELS

**Change:** Line 11 — add `export` keyword:

```typescript
// BEFORE:
const STAT_LABELS: Array<[keyof PlayerPiece, string]> = [
// AFTER:
export const STAT_LABELS: Array<[keyof PlayerPiece, string]> = [
```

One-character change. No other modifications to this file.

---

### `packages/server/src/__tests__/gameEngine.phase24.test.ts` (new)

**Analog:** Existing server test files in `packages/server/src/__tests__/`. Use Vitest (`describe`, `it`, `expect`). Import `computeAutoAssignment` directly (pure function — no Socket.io mocking needed).

**Test structure pattern** (mirror existing unit tests):

```typescript
import { describe, it, expect } from 'vitest';
import { computeAutoAssignment } from '../gameEngine.js';
import { FORMATIONS } from '@counter-attack/shared';
import { getSquadPlayers } from '@counter-attack/shared';

describe('computeAutoAssignment', () => {
  it('places GK in slot 0', () => { ... });
  it('fills anchor roles before flex roles', () => { ... });
  it('tie-breaks by lower source-team index', () => { ... });
  it('scoreForRole returns correct numeric result for FWD-central', () => { ... });
});
```

---

## Shared Patterns

### isProcessing Mutex

**Source:** `packages/server/src/roomHandlers.ts` lines 310–403
**Apply to:** `LINEUP_SWAP` handler, `LINEUP_CONFIRM` handler

```typescript
if (room.isProcessing) return;
room.isProcessing = true;
try {
  // ... handler logic ...
} finally {
  room.isProcessing = false;
}
```

### GAME_ERROR Emit

**Source:** `packages/server/src/roomHandlers.ts` line 315
**Apply to:** All validation failures in `LINEUP_SWAP` (GK_SLOT_LOCKED, INVALID_SLOT_INDEX, WRONG_PHASE) and `LINEUP_CONFIRM` (WRONG_PHASE)

```typescript
socket.emit(ServerEvents.GAME_ERROR, 'GK_SLOT_LOCKED');
return;
```

### Socket.on/off Pair

**Source:** `packages/client/src/App.tsx` lines 116–142
**Apply to:** `LINEUP_ASSIGNMENT_READY`, `LINEUP_ASSIGNMENT_UPDATED` registrations
Every `socket.on(event, fn)` must appear in both the registration block and the cleanup `return () => { socket.off(event, fn); }`.

### CSS Modules + Heading/Status Strings

**Source:** `packages/client/src/components/UniformSelectionScreen.tsx` lines 178–188
**Apply to:** `LineupAssignmentScreen.tsx`
Use identical string literals: `'Make your selections now!'` and `` `Waiting for ${waitingForLabel} Player to Lock in their Selection.` `` — no paraphrasing.

### Optional Room Field with JSDoc

**Source:** `packages/server/src/roomStore.ts` lines 57–115
**Apply to:** Four new Room fields in Phase 24
Each field gets a JSDoc block with Phase reference, lifecycle description (when set, when consumed), and sentinel value explanation.

---

## No Analog Found

| File                                                               | Role   | Data Flow | Reason                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/client/src/components/LineupAssignmentScreen.module.css` | config | —         | No direct analog — layout is novel (horizontal 4-column formation grid + bench row). Reference `UniformSelectionScreen.module.css` for `.screen`, `.matchSetupHeading`, `.statusActive`, `.statusWaiting`, `.confirmButtonGreen` class names and values; CSS grid layout for columns is new. |

---

## Metadata

**Analog search scope:** `packages/server/src/`, `packages/client/src/`, `packages/shared/src/`
**Files scanned:** 8 source files read directly
**Pattern extraction date:** 2026-07-10
