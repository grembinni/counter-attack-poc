# Phase 4: Game Engine + Phase FSM - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 9 (7 new/modified source files + 2 new test files)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File                                        | Role       | Data Flow        | Closest Analog                                           | Match Quality                        |
| -------------------------------------------------------- | ---------- | ---------------- | -------------------------------------------------------- | ------------------------------------ |
| `packages/shared/src/types.ts`                           | model      | transform        | self (extend)                                            | exact                                |
| `packages/shared/src/events.ts`                          | config     | event-driven     | self (extend)                                            | exact                                |
| `packages/shared/src/teams.ts`                           | utility    | transform        | `packages/shared/src/pitch.ts`                           | role-match (static data export)      |
| `packages/shared/src/pitch.ts`                           | utility    | transform        | self (extend) + `hex.ts`                                 | exact                                |
| `packages/shared/src/index.ts`                           | config     | transform        | self (extend)                                            | exact                                |
| `packages/server/src/gameEngine.ts`                      | service    | CRUD             | `packages/server/src/roomStore.ts`                       | role-match (pure functions on state) |
| `packages/server/src/gameHandlers.ts`                    | controller | event-driven     | `packages/server/src/roomHandlers.ts`                    | exact                                |
| `packages/server/src/createServer.ts`                    | config     | request-response | self (extend)                                            | exact                                |
| `packages/server/src/roomStore.ts`                       | service    | CRUD             | self (extend)                                            | exact                                |
| `packages/shared/src/teams.test.ts`                      | test       | CRUD             | `packages/shared/src/moveValidator.test.ts`              | role-match                           |
| `packages/server/src/__tests__/gameEngine.test.ts`       | test       | CRUD             | `packages/server/src/__tests__/roomStore.test.ts`        | role-match                           |
| `packages/server/src/__tests__/game.integration.test.ts` | test       | event-driven     | `packages/server/src/__tests__/room.integration.test.ts` | exact                                |

---

## Pattern Assignments

### `packages/shared/src/types.ts` (model, transform) — EXTEND

**Analog:** self — read before touching

**Current state snapshot** (lines 1–61 of types.ts):

- `PlayerPiece` has all 9 attribute fields but no `name: string` or `role: 'GK' | 'DEF' | 'MID' | 'FWD'`
- `GameState.eventLog` is typed `readonly unknown[]` — replace with `readonly ActionEvent[]`
- No `RefereeCard` type exists
- `movementSlot: 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2' | null` already on `GameState` — export as named type `MovementSlot`

**Extend pattern** — add after the existing `movementSlot` field in `GameState`, following the existing JSDoc block style:

```typescript
// Add to PlayerPiece (after aerialAbility):
name: string;
role: 'GK' | 'DEF' | 'MID' | 'FWD';

// New named type (export alongside GamePhase):
export type MovementSlot = 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2';

// New type (add before GameState):
export type RefereeCard = {
  leniency: number; // 1–6 range, matches dice face range per MATCH-02
};

// New discriminated union (add before GameState):
export type ActionEventType =
  | 'MOVE'
  | 'SLOT_ADVANCE'
  | 'DICE_ROLL'
  | 'STEAL_ATTEMPT'
  | 'GOAL'
  | 'KICK_OFF';

export type ActionEvent =
  | { type: 'MOVE'; pieceId: string; from: HexCoord; to: HexCoord; slot: MovementSlot; timestamp: number }
  | { type: 'SLOT_ADVANCE'; from: MovementSlot; to: MovementSlot | null; timestamp: number }
  | { type: 'DICE_ROLL'; result: number; timestamp: number }
  | { type: 'STEAL_ATTEMPT'; defenderId: string; result: 'SUCCESS' | 'FAIL'; timestamp: number }
  | { type: 'GOAL'; scoringTeam: 'home' | 'away'; timestamp: number }
  | { type: 'KICK_OFF'; timestamp: number };

// New fields on GameState (replace eventLog line; add refereeCard and attackingTeam):
eventLog: readonly ActionEvent[];          // replaces: readonly unknown[]
refereeCard: RefereeCard;                  // new — TEAM-03
attackingTeam: 'home' | 'away';            // new — set at KICK_OFF, constant through Movement Phase
```

**Existing field to update in `GameState`** (line 46):

```typescript
// BEFORE:
eventLog: readonly unknown[];
// AFTER:
eventLog: readonly ActionEvent[];
```

**Existing `movementSlot` inline union** (line 60) — replace with named type reference:

```typescript
// BEFORE:
movementSlot: 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2' | null;
// AFTER:
movementSlot: MovementSlot | null;
```

---

### `packages/shared/src/events.ts` (config, event-driven) — EXTEND

**Analog:** self — read file before touching (lines 1–57)

**Existing const object pattern** (lines 7–19) — copy this shape for new entries:

```typescript
export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  GAME_MOVE: 'game:move',
  GAME_ROLL: 'game:roll',
} as const;

export const ServerEvents = {
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
  GAME_STATE: 'game:state',
  GAME_DISCONNECT_WARNING: 'game:disconnect-warning',
} as const;
```

**Add to ClientEvents** (append inside the `as const` object):

```typescript
GAME_END_TURN: 'game:end-turn',
GAME_UNDO: 'game:undo',
```

**Add to ServerEvents** (append inside the `as const` object):

```typescript
GAME_ERROR: 'game:error',
```

**Existing typed interface pattern** (lines 25–41) — copy this shape for new entries:

```typescript
export interface ClientToServerEvents {
  [ClientEvents.ROOM_CREATE]: () => void;
  [ClientEvents.ROOM_JOIN]: (roomCode: string) => void;
  [ClientEvents.GAME_MOVE]: (from: HexCoord, to: HexCoord) => void;
  [ClientEvents.GAME_ROLL]: () => void;
}

export interface ServerToClientEvents {
  [ServerEvents.ROOM_JOINED]: (roomCode: string, playerSlot: 1 | 2, sessionToken: string) => void;
  [ServerEvents.ROOM_ERROR]: (message: string) => void;
  [ServerEvents.GAME_STATE]: (state: GameState) => void;
  [ServerEvents.GAME_DISCONNECT_WARNING]: () => void;
}
```

**Add to ClientToServerEvents:**

```typescript
[ClientEvents.GAME_END_TURN]: () => void;
[ClientEvents.GAME_UNDO]: () => void;
```

**Also update GAME_MOVE signature** — extend to include `pieceId` per open question OQ-1 from RESEARCH.md:

```typescript
// BEFORE:
[ClientEvents.GAME_MOVE]: (from: HexCoord, to: HexCoord) => void;
// AFTER:
[ClientEvents.GAME_MOVE]: (pieceId: string, to: HexCoord) => void;
```

**Add to ServerToClientEvents:**

```typescript
[ServerEvents.GAME_ERROR]: (reason: string) => void;
```

---

### `packages/shared/src/teams.ts` (utility, transform) — NEW

**Analog:** `packages/shared/src/pitch.ts` (static data export pattern)

**File header and module pattern** (pitch.ts lines 1–10):

```typescript
import type { HexCoord } from './types.js';

// PLACEHOLDER: This grid is a rectangular approximation of the Counter Attack board.
// ...comment block explaining the constraint...

export const PITCH_HEXES: readonly HexCoord[] = (() => { ... })();
```

**Adapt to teams.ts** — same import-from-types, readonly export, block comment pattern:

```typescript
import type { PlayerPiece } from './types.js';

// Hardcoded squads for Phase 4. Attribute values (1–10 scale) follow role conventions:
// GK: high Saving/Handling; DEF: high Tackling; MID: balanced; FWD: high Pace/Shooting.
// Starting positions use placeholder grid (q 0–11 home half, q 12–24 away half).
// Phase 6 replaces positions with real board coordinates when measurements are provided.

export const HOME_SQUAD: readonly PlayerPiece[] = [ ... ]; // 11 entries, ids 'home-0'..'home-10'
export const AWAY_SQUAD: readonly PlayerPiece[] = [ ... ]; // 11 entries, ids 'away-0'..'away-10'
```

**PlayerPiece shape to populate** (from types.ts lines 3–16, extended with Phase 4 additions):

```typescript
// Each entry follows this shape (all 9 attributes + name + role + id + teamId + position):
{
  id: 'home-0',
  teamId: 'home',
  name: 'GK Home',
  role: 'GK',
  position: { q: 0, r: 7 },        // placeholder centre of home goal line
  pace: 2, shooting: 1, tackling: 4, dribbling: 3,
  heading: 5, saving: 9, handling: 8, resilience: 6, aerialAbility: 7,
}
```

**Piece ID scheme:** `'home-0'` through `'home-10'`, `'away-0'` through `'away-10'` — deterministic, no UUID needed (RESEARCH.md §Don't Hand-Roll).

**Starting position guidance** (placeholder grid is q 0–24, r 0–15):

- Home GK: `{ q: 0, r: 7 }` — home goal line centre
- Home defenders: q 2–4 range
- Home midfielders: q 5–8 range
- Home forwards: q 9–11 range
- Away squad: symmetric (q 24 down to q 12)
- Ball carrier on kick-off hex `{ q: 12, r: 7 }` — assigned to one FWD from the home team (or whoever wins coin flip)

---

### `packages/shared/src/pitch.ts` (utility, transform) — EXTEND

**Analog:** self + `packages/shared/src/hex.ts` for `hexesInRange`

**Existing export pattern** (lines 1–26) — preserve the existing `PITCH_HEXES` export unchanged. Add below it.

**Imports to add** (hex.ts line 1 shows the import pattern):

```typescript
import { hexesInRange } from './hex.js';
```

**hexKey helper and Set-based region pattern** — per RESEARCH.md Pitfall 6:

```typescript
// O(1) structural equality for HexCoord membership checks.
// NEVER use Array.includes() for HexCoord — object identity fails structural checks.
const hexKey = (h: HexCoord): string => `${h.q},${h.r}`;

export type PitchRegions = {
  homeThird: ReadonlySet<string>;
  awayThird: ReadonlySet<string>;
  middleThird: ReadonlySet<string>;
  homePenaltyArea: ReadonlySet<string>;
  awayPenaltyArea: ReadonlySet<string>;
  homeSixYardBox: ReadonlySet<string>;
  awaySixYardBox: ReadonlySet<string>;
  centreCircle: ReadonlySet<string>;
  kickOffHex: HexCoord;
};

// Region derivations from 25×16 placeholder grid.
// PLACEHOLDER: These boundaries are approximations — not from physical board measurements.
// Replace in Phase 6 with real axial coordinates.
const buildRegion = (hexes: HexCoord[]): ReadonlySet<string> => new Set(hexes.map(hexKey));

export const PITCH_REGIONS: PitchRegions = {
  homeThird: buildRegion(PITCH_HEXES.filter((h) => h.q <= 7)),
  awayThird: buildRegion(PITCH_HEXES.filter((h) => h.q >= 17)),
  middleThird: buildRegion(PITCH_HEXES.filter((h) => h.q >= 8 && h.q <= 16)),
  homePenaltyArea: buildRegion(PITCH_HEXES.filter((h) => h.q <= 3 && h.r >= 4 && h.r <= 11)),
  awayPenaltyArea: buildRegion(PITCH_HEXES.filter((h) => h.q >= 21 && h.r >= 4 && h.r <= 11)),
  homeSixYardBox: buildRegion(PITCH_HEXES.filter((h) => h.q <= 1 && h.r >= 6 && h.r <= 9)),
  awaySixYardBox: buildRegion(PITCH_HEXES.filter((h) => h.q >= 23 && h.r >= 6 && h.r <= 9)),
  centreCircle: buildRegion(hexesInRange({ q: 12, r: 7 }, 3)),
  kickOffHex: { q: 12, r: 7 },
};

// Difficult-angle hexes (dot-marked on physical board).
// PLACEHOLDER — approximate positions on placeholder grid. Phase 6 replaces with real coords.
export const DIFFICULT_ANGLE_HEXES: ReadonlySet<string> = buildRegion([
  { q: 2, r: 3 },
  { q: 3, r: 3 },
  { q: 2, r: 4 },
  { q: 3, r: 4 }, // home end near-post
  { q: 2, r: 10 },
  { q: 3, r: 10 },
  { q: 2, r: 11 },
  { q: 3, r: 11 }, // home end far-post
  { q: 21, r: 3 },
  { q: 22, r: 3 },
  { q: 21, r: 4 },
  { q: 22, r: 4 }, // away end near-post
  { q: 21, r: 10 },
  { q: 22, r: 10 },
  { q: 21, r: 11 },
  { q: 22, r: 11 }, // away end far-post
]);

// Predicate helpers — used by validators and gameEngine to avoid Set lookup boilerplate.
export function isInRegion(hex: HexCoord, region: keyof Omit<PitchRegions, 'kickOffHex'>): boolean {
  return (PITCH_REGIONS[region] as ReadonlySet<string>).has(hexKey(hex));
}

export function isDifficultAngle(hex: HexCoord): boolean {
  return DIFFICULT_ANGLE_HEXES.has(hexKey(hex));
}

// Used by Loose Ball boundary enforcement in scoreUtils.ts (referenced in RESEARCH.md §Don't Hand-Roll)
export function isPitchHex(hex: HexCoord): boolean {
  return PITCH_HEXES.some((h) => h.q === hex.q && h.r === hex.r);
}
```

---

### `packages/shared/src/index.ts` (config, transform) — EXTEND

**Analog:** self (lines 1–14)

**Existing barrel pattern** (lines 1–14):

```typescript
// Single barrel export for @counter-attack/shared (D-05).
// All consumers import from '@counter-attack/shared' — no sub-path imports.
export * from './types.js';
export * from './hex.js';
export * from './events.js';
export * from './pitch.js';
export * from './scoreUtils.js';
export * from './moveValidator.js';
// ... rest of validators
```

**Add after `pitch.js` export:**

```typescript
export * from './teams.js';
```

No other changes needed — `types.ts` additions are re-exported via the existing `export * from './types.js'`.

---

### `packages/server/src/gameEngine.ts` (service, CRUD) — NEW

**Analog:** `packages/server/src/roomStore.ts` (pure-function module pattern)

**Module header pattern** (roomStore.ts lines 1–17):

```typescript
/**
 * [Module description — one paragraph explaining responsibilities and ARCH refs]
 */

import { randomInt } from 'crypto';
import type { GameState, ... } from '@counter-attack/shared';
import { HOME_SQUAD, AWAY_SQUAD, ... } from '@counter-attack/shared';
```

**Pure function export pattern** (roomStore.ts lines 80–102) — adapt to game engine functions. No socket.io imports in this file (pure functions only):

```typescript
/**
 * Builds the initial GameState when the second player joins.
 *
 * D-12: Called from roomStore.joinRoom() immediately on second-player join.
 * D-13: Home/away assignment uses crypto.randomInt coin flip (never client-supplied).
 * D-14: FSM auto-advances LOBBY → KICK_OFF; no player event needed.
 */
export function buildInitialGameState(roomCode: string): GameState {
  const homeIsSlot1 = randomInt(0, 2) === 0; // D-13: server-side coin flip
  // ... place 22 pieces from HOME_SQUAD/AWAY_SQUAD at starting positions ...
  // ... assign refereeCard: { leniency: 3 } ...
  // ... return state with phase: 'KICK_OFF', movementSlot: null, eventLog: [] ...
}
```

**Discriminated union result pattern** (moveValidator.ts lines 28–40) — all gameEngine functions return this shape:

```typescript
export type ApplyMoveResult =
  | {
      ok: false;
      reason: 'WRONG_SLOT' | 'WRONG_TEAM' | 'PIECE_NOT_FOUND' | 'MOVE_INVALID';
      detail?: string;
    }
  | { ok: true; state: GameState };

export type ApplyEndTurnResult =
  | { ok: false; reason: 'WRONG_SLOT' | 'WRONG_TEAM' }
  | { ok: true; state: GameState };

export type ApplyUndoResult =
  | { ok: false; reason: 'UNDO_LOCKED' | 'NOTHING_TO_UNDO' }
  | { ok: true; state: GameState };
```

**Guard-first pattern** (moveValidator.ts lines 57–98, roomStore.ts joinRoom lines 119–158):

```typescript
export function applyMove(state: GameState, pieceId: string, to: HexCoord): ApplyMoveResult {
  // 1. Phase guard
  if (state.phase !== 'MOVEMENT' || state.movementSlot === null) {
    return { ok: false, reason: 'WRONG_SLOT' };
  }
  // 2. Piece lookup
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };
  // 3. Team guard (active player only)
  if (piece.teamId !== activeTeamForSlot(state)) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }
  // 4. Delegate to validator
  const result = validateMove(state, piece, to);
  if (!result.ok) return { ok: false, reason: 'MOVE_INVALID', detail: result.reason };
  // 5. Build new state (immutable — spread, never mutate)
  const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));
  const newEvent: ActionEvent = {
    type: 'MOVE',
    pieceId,
    from: piece.position,
    to,
    slot: state.movementSlot,
    timestamp: Date.now(),
  };
  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      paceUsedByPieceId: {
        ...state.paceUsedByPieceId,
        [pieceId]: (state.paceUsedByPieceId[pieceId] ?? 0) + 1,
      },
      eventLog: [...state.eventLog, newEvent],
    },
  };
}
```

**Immutable state update pattern** — NEVER mutate `state.pieces` or `state.eventLog` directly. Always spread (roomStore.ts lines 143–156 shows the existing GameState object literal pattern, gameEngine creates new ones):

```typescript
// WRONG — TypeScript readonly will reject this:
state.pieces.push(newPiece);
state.eventLog.push(newEvent);

// CORRECT — return new state with spread:
return {
  ok: true,
  state: {
    ...state,
    pieces: [...state.pieces.map((p) => (p.id === id ? { ...p, position: to } : p))],
    eventLog: [...state.eventLog, newEvent],
  },
};
```

**FSM slot advancement function** (RESEARCH.md Pattern 1 — explicit FSM, not if/else chains):

```typescript
const SLOT_SEQUENCE: readonly MovementSlot[] = ['ATTACKER_4', 'DEFENDER_5', 'ATTACKER_2'];

export function advanceMovementSlot(state: GameState): {
  nextSlot: MovementSlot | null;
  nextPhase: GamePhase;
} {
  const idx = SLOT_SEQUENCE.indexOf(state.movementSlot!);
  if (idx === SLOT_SEQUENCE.length - 1) {
    return { nextSlot: null, nextPhase: 'PASS' }; // D-04: ATTACKER_2 done → auto to PASS
  }
  return { nextSlot: SLOT_SEQUENCE[idx + 1]!, nextPhase: 'MOVEMENT' };
}
```

**Stub dice for Phase 4** (RESEARCH.md Pitfall 7 — deterministic stub, replaced in Phase 5):

```typescript
// TODO Phase 5: replace with crypto.randomInt(1, 7)
function stubDice(): number {
  return 3; // fixed value for Phase 4 testing
}
```

---

### `packages/server/src/gameHandlers.ts` (controller, event-driven) — NEW

**Analog:** `packages/server/src/roomHandlers.ts` (exact match — registerXHandlers pattern)

**Module header pattern** (roomHandlers.ts lines 1–42):

```typescript
/**
 * Socket.io event handlers for game action management.
 *
 * Wires GAME_MOVE, GAME_END_TURN, GAME_UNDO onto a socket.
 * Called from createServer.ts io.on('connection') alongside registerRoomHandlers.
 *
 * [Requirement cross-references here]
 * [Anti-pattern rationale here]
 */

import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';
import type { Server, Socket } from 'socket.io';
import { broadcastState, getRoom } from './roomStore.js';
import { applyMove, applyEndTurn, applyUndo } from './gameEngine.js';
```

**AppSocket and AppServer type aliases** (roomHandlers.ts lines 38–41) — copy exactly:

```typescript
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
```

**registerGameHandlers function signature** (mirrors registerRoomHandlers lines 60–64):

```typescript
export function registerGameHandlers(
  io: AppServer,
  socket: AppSocket,
): void {
```

**isProcessing mutex pattern per handler** (RESEARCH.md Pattern 2, STATE.md pitfall — copy this exact structure for every handler):

```typescript
socket.on(ClientEvents.GAME_MOVE, (pieceId: string, to: HexCoord) => {
  const roomCode = socket.data.roomCode;
  if (roomCode === undefined) return; // no room — drop silently
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // success criterion 5: drop duplicate

  room.isProcessing = true;
  try {
    if (room.gameState === null || room.gameState.phase !== 'MOVEMENT') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    const result = applyMove(room.gameState, pieceId, to);
    if (!result.ok) {
      socket.emit(ServerEvents.GAME_ERROR, result.reason);
      broadcastState(io, room); // snap-back so client re-syncs (D-06)
      return;
    }
    room.gameState = result.state;
    broadcastState(io, room);
  } finally {
    room.isProcessing = false; // MUST be in finally — prevents permanent lock on throw
  }
});
```

**Guard pattern for wrong-player rejection** (roomHandlers.ts lines 73–76 show the socket.data read pattern; gameHandlers adds team validation on top):

```typescript
// Read socket.data.playerSlot — NEVER read socket.rooms (RESEARCH.md Pitfall 2)
const { roomCode, playerSlot } = socket.data;
if (roomCode === undefined || playerSlot === undefined) return;
```

**broadcastState call placement** — always inside `try`, before `finally` (roomStore.ts lines 226–229 shows the single ARCH-04 entry point):

```typescript
// ARCH-04: single broadcast entry point — never call io.to().emit directly
broadcastState(io, room);
```

---

### `packages/server/src/createServer.ts` (config, request-response) — EXTEND

**Analog:** self (read lines 1–130 before touching)

**Existing registration call pattern** (createServer.ts line 126) — add `registerGameHandlers` alongside it:

```typescript
// BEFORE (fresh connection path, line 126):
registerRoomHandlers(io, socket, false);

// AFTER:
registerRoomHandlers(io, socket, false);
registerGameHandlers(io, socket);
```

**Reconnect path** (createServer.ts lines 86–122) — also register game handlers for reconnected sockets so they can continue mid-game:

```typescript
// Inside the reconnect block, after registerRoomHandlers(io, socket, true):
registerGameHandlers(io, socket);
```

**Import to add** (alongside existing import on line 25):

```typescript
import { registerGameHandlers } from './gameHandlers.js';
```

---

### `packages/server/src/roomStore.ts` (service, CRUD) — EXTEND

**Analog:** self (read lines 118–158 before touching)

**Existing stub GameState in joinRoom** (lines 141–156) — replace with `buildInitialGameState` call:

```typescript
// BEFORE (lines 141–156):
room.gameState = {
  roomCode,
  phase: 'LOBBY',
  activeTeam: 'home',
  pieces: [],
  ball: { position: { q: 0, r: 0 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
};

// AFTER (D-12, D-14):
room.gameState = buildInitialGameState(roomCode);
```

**Import to add** (after existing imports block):

```typescript
import { buildInitialGameState } from './gameEngine.js';
```

No other changes to roomStore.ts — `broadcastState`, `Room` type, and all other exports remain unchanged.

---

### `packages/shared/src/teams.test.ts` (test, CRUD) — NEW

**Analog:** `packages/shared/src/moveValidator.test.ts` (unit test pattern for pure shared functions)

**Test file header pattern** (moveValidator.test.ts lines 1–34):

```typescript
import { describe, it, expect } from 'vitest';
import { HOME_SQUAD, AWAY_SQUAD } from './teams.js';

// No fixtures needed — teams.ts exports static readonly arrays
```

**Test structure pattern** (moveValidator.test.ts — describe blocks per exported symbol):

```typescript
describe('HOME_SQUAD', () => {
  it('contains exactly 11 players (TEAM-01)', () => { ... });
  it('each player has all 9 attributes as integers 1–10 (TEAM-01)', () => { ... });
  it('each player has a name and role field (TEAM-02)', () => { ... });
  it('has exactly 1 GK (TEAM-01)', () => { ... });
});

describe('AWAY_SQUAD', () => { /* same assertions */ });
```

**Assertion style** (moveValidator.test.ts lines 36–55) — direct `expect().toBe()`, no complex matchers:

```typescript
expect(HOME_SQUAD).toHaveLength(11);
for (const p of HOME_SQUAD) {
  expect(p.pace).toBeGreaterThanOrEqual(1);
  expect(p.pace).toBeLessThanOrEqual(10);
}
```

---

### `packages/server/src/__tests__/gameEngine.test.ts` (test, CRUD) — NEW

**Analog:** `packages/server/src/__tests__/roomStore.test.ts` (unit test pattern for pure server functions)

**Test file header pattern** (roomStore.test.ts lines 1–13):

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { buildInitialGameState, applyMove, applyEndTurn, applyUndo } from '../gameEngine.js';
import { clearAllRooms } from '../roomStore.js';

afterEach(() => {
  clearAllRooms();
});
```

**No socket.io in unit tests** — gameEngine.ts has no socket.io imports, so tests import and call functions directly with plain GameState objects.

**Fixture pattern** (moveValidator.test.ts lines 5–33) — build a minimal `GameState` fixture:

```typescript
// Reuse the same fixture shape from moveValidator.test.ts (copy basePiece / baseState pattern)
// but extend with Phase 4 fields (name, role, refereeCard, attackingTeam, eventLog typed):
const baseState: GameState = {
  roomCode: 'TEST',
  phase: 'MOVEMENT',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [...],
  ball: { position: { q: 12, r: 7 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: 'ATTACKER_4',
  refereeCard: { leniency: 3 },
};
```

---

### `packages/server/src/__tests__/game.integration.test.ts` (test, event-driven) — NEW

**Analog:** `packages/server/src/__tests__/room.integration.test.ts` (exact match — full server integration test)

**Server lifecycle pattern** (room.integration.test.ts lines 31–61) — copy exactly:

```typescript
let httpServer: ReturnType<typeof buildServer>['httpServer'];
let address: string;
const connectedClients: Socket[] = [];

beforeEach(async () => {
  const server = buildServer();
  httpServer = server.httpServer;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      resolve();
    });
  });
  const addr = httpServer.address() as { port: number };
  address = `http://localhost:${addr.port}`;
});

afterEach(async () => {
  for (const client of connectedClients) {
    if (client.connected) client.disconnect();
  }
  connectedClients.length = 0;
  await new Promise<void>((resolve) => {
    httpServer.close(() => {
      resolve();
    });
  });
  clearAllRooms();
});
```

**createClient helper** (room.integration.test.ts lines 72–83) — copy exactly, no changes:

```typescript
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
```

**oncePromise helper** (room.integration.test.ts lines 92–109) — copy exactly:

```typescript
function oncePromise<E extends keyof ServerToClientEvents>(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  event: E,
  timeoutMs = 1000,
): Promise<Parameters<ServerToClientEvents[E]>> { ... }
```

**roomSetup helper** — add a helper that creates a full room with 2 players and waits for `KICK_OFF` state (specific to game integration tests):

```typescript
async function setupRoom(): Promise<{
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
  roomCode: string;
  state: GameState;
}> {
  const clientA = createClient();
  const clientB = createClient();
  await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

  const createPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
  clientA.emit(ClientEvents.ROOM_CREATE);
  const [roomCode] = await createPromise;

  const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
  clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
  const [state] = await stateAPromise;
  return { clientA, clientB, roomCode, state };
}
```

**Test scenario pattern** (room.integration.test.ts lines 144–160) — one `it` per requirement:

```typescript
it('game:move from wrong slot returns game:error WRONG_SLOT (MOVE-01)', async () => {
  const { clientA, state } = await setupRoom();
  // state.phase is 'KICK_OFF' — movement not yet started
  const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
  clientA.emit(ClientEvents.GAME_MOVE, 'home-0', { q: 1, r: 7 });
  const [reason] = await errorPromise;
  expect(reason).toBe('WRONG_PHASE');
});
```

---

## Shared Patterns

### Named Exports, No Defaults

**Source:** All existing source files in both packages
**Apply to:** All Phase 4 files

```typescript
// CORRECT:
export function buildInitialGameState(...) { ... }
export const HOME_SQUAD: readonly PlayerPiece[] = [...];

// NEVER:
export default function buildInitialGameState(...) { ... }
```

### `.js` Extensions on Local Imports

**Source:** Every file in the codebase (e.g., roomHandlers.ts line 32, moveValidator.ts line 15)
**Apply to:** All Phase 4 files

```typescript
import { validateMove } from './moveValidator.js'; // .js not .ts
import { broadcastState, getRoom } from './roomStore.js';
```

### isProcessing Mutex

**Source:** `packages/server/src/roomStore.ts` lines 43–49 (type) + `packages/server/src/roomHandlers.ts` pattern
**Apply to:** Every handler in `gameHandlers.ts`

```typescript
// Mutex pattern — copy for EVERY socket.on in gameHandlers.ts:
if (!room || room.isProcessing) return; // drop silently
room.isProcessing = true;
try {
  // ... all handler logic ...
  broadcastState(io, room);
} finally {
  room.isProcessing = false; // MUST be finally — never conditionally
}
```

### socket.data Over socket.rooms

**Source:** `packages/server/src/roomHandlers.ts` lines 161–163
**Apply to:** All handlers in `gameHandlers.ts`

```typescript
// CORRECT (established pattern):
const { roomCode, playerSlot } = socket.data;

// NEVER (RESEARCH.md Pitfall 2):
const rooms = socket.rooms;
```

### broadcastState as Single ARCH-04 Entry Point

**Source:** `packages/server/src/roomStore.ts` lines 226–229
**Apply to:** Every state-mutating handler in `gameHandlers.ts`

```typescript
// ALWAYS call broadcastState after every state change — both success and snap-back paths:
broadcastState(io, room);
// NEVER:
io.to(room.roomCode).emit(ServerEvents.GAME_STATE, room.gameState);
```

### Guard-First Early Returns

**Source:** `packages/shared/src/moveValidator.ts` lines 57–98, `packages/server/src/roomStore.ts` lines 119–133
**Apply to:** `gameEngine.ts` all functions, `gameHandlers.ts` all handlers

```typescript
// Validate first, happy path last:
if (state.movementSlot === null) return { ok: false, reason: 'WRONG_SLOT' };
if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };
// ... more guards ...
return { ok: true, state: newState }; // happy path always last
```

### Discriminated Union Results

**Source:** `packages/shared/src/moveValidator.ts` lines 28–40 (`MoveResult` type)
**Apply to:** All functions exported from `gameEngine.ts`

```typescript
// Pattern: { ok: false; reason: LiteralType } | { ok: true; ... }
// Handlers narrow with: if (!result.ok) { socket.emit(GAME_ERROR, result.reason); return; }
```

### JSDoc on All Exported Symbols

**Source:** `packages/server/src/roomStore.ts` (every exported function has JSDoc), `packages/shared/src/moveValidator.ts` (type and function both documented)
**Apply to:** All exported types and functions in Phase 4 files

```typescript
/**
 * [Summary — one sentence]
 *
 * [Relevant requirement/decision cross-references, e.g. D-12, TEAM-01]
 * [Guard precedence if applicable]
 *
 * @param paramName - description
 * @returns description
 */
```

---

## No Analog Found

All Phase 4 files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `packages/shared/src/`, `packages/server/src/`, `packages/server/src/__tests__/`, `packages/shared/src/*.test.ts`
**Files scanned:** 14 source files read in full
**Pattern extraction date:** 2026-05-29
