# Phase 5: Dice Resolver + All Resolution Branches - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 10 (7 modified, 1 new, 2 test files updated/created)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File                                 | Role       | Data Flow        | Closest Analog                                                    | Match Quality |
| ------------------------------------------------- | ---------- | ---------------- | ----------------------------------------------------------------- | ------------- |
| `packages/server/src/diceUtils.ts`                | utility    | transform        | `packages/server/src/gameEngine.ts` (crypto import)               | role-match    |
| `packages/server/src/gameEngine.ts`               | service    | event-driven     | itself (extend `applyMove`, `applyEndTurn`, `applyStartMovement`) | exact         |
| `packages/server/src/gameHandlers.ts`             | middleware | request-response | itself (extend `registerGameHandlers`)                            | exact         |
| `packages/shared/src/types.ts`                    | model      | —                | itself (extend `PlayerPiece`, `GameState`)                        | exact         |
| `packages/shared/src/events.ts`                   | config     | —                | itself (extend `ClientEvents`, `ClientToServerEvents`)            | exact         |
| `packages/shared/src/teams.ts`                    | config     | —                | itself (add `highPass` to all 22 players)                         | exact         |
| `packages/shared/src/passValidator.ts`            | utility    | transform        | itself (fix `validatePassAccuracy`)                               | exact         |
| `packages/shared/src/shotValidator.ts`            | utility    | transform        | itself (fix `validateShotDuel` tie outcome)                       | exact         |
| `packages/shared/src/shotValidator.test.ts`       | test       | —                | `packages/shared/src/headingValidator.test.ts`                    | exact         |
| `packages/server/src/__tests__/diceUtils.test.ts` | test       | —                | `packages/server/src/__tests__/gameEngine.test.ts`                | exact         |

---

## Pattern Assignments

### `packages/server/src/diceUtils.ts` (utility, transform) — NEW FILE

**Analog:** `packages/server/src/gameEngine.ts` — the only existing file that already imports from `'crypto'`

**Imports pattern** (`gameEngine.ts` line 15):

```typescript
import { randomInt } from 'crypto';
```

**Core pattern** — the entire file follows this shape:

```typescript
// packages/server/src/diceUtils.ts
import { randomInt } from 'crypto';

/**
 * Rolls a single d6. Returns 1–6 inclusive.
 * All dice in the game use this function — no other RNG source permitted (D-08, DICE-01).
 */
export function rollDice(): number {
  return randomInt(1, 7); // min inclusive, max exclusive → 1..6
}
```

**Conventions:**

- Named export (no default). Matches all shared/server module conventions.
- `.js` extension NOT needed on this import — it's a Node built-in, not a local path.
- JSDoc comment documents the d6 range and the D-08 constraint explicitly.

---

### `packages/server/src/gameEngine.ts` (service, event-driven) — EXTEND

**Analog:** itself — the `applyStartMovement`, `applyMove`, `applyEndTurn`, `applyUndo` functions are the pattern to copy.

**Discriminated union result type pattern** (lines 117–119, 153–159, 261–263, 316–318):

```typescript
// Pattern: one { ok: false } branch per rejection reason, one { ok: true; state } branch
export type ApplyRollResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'WRONG_TEAM' }
  | { ok: true; state: GameState };

export type ApplyGKRestartResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'WRONG_TEAM' | 'INVALID_CHOICE' }
  | { ok: true; state: GameState };
```

**Guard-first early return pattern** (`applyMove` lines 177–195):

```typescript
export function applyMove(state: GameState, pieceId: string, to: HexCoord): ApplyMoveResult {
  // 1. Phase guard
  if (state.phase !== 'MOVEMENT' || state.movementSlot === null) {
    return { ok: false, reason: 'WRONG_SLOT' };
  }
  // 2. Piece lookup
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };
  // 3. Team guard
  if (piece.teamId !== activeTeamForSlot(state)) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }
  // 4. Delegate to validator ...
```

**Immutable state spread pattern** (`applyMove` lines 198–255):

```typescript
// Build new state via spread — never mutate readonly arrays
const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));
// ...
return {
  ok: true,
  state: {
    ...state,
    pieces: newPieces,
    movedPieceIds: [...state.movedPieceIds, pieceId],
    paceUsedByPieceId: { ...state.paceUsedByPieceId, [pieceId]: ... },
    eventLog: [...state.eventLog, moveEvent],
    pendingFreeMove,
  },
};
```

**Event log append pattern** (`applyStartMovement` lines 135–136, `applyMove` lines 200–207):

```typescript
const event: ActionEvent = { type: 'KICK_OFF', timestamp: Date.now() };
// or:
const moveEvent: ActionEvent = {
  type: 'MOVE',
  pieceId,
  from: piece.position, // server-derived — never trust client from-coord
  to,
  slot: state.movementSlot,
  timestamp: Date.now(),
};
// Always: eventLog: [...state.eventLog, event]
```

**`stubDice()` replacement** (`gameEngine.ts` lines 34–36, 213–217):

```typescript
// BEFORE (Phase 4 stub — remove entirely in Phase 5):
function stubDice(): number {
  return 3;
}
// ...
const dice = stubDice(); // TODO Phase 5: replace with crypto.randomInt(1, 7)
const stealResult: 'SUCCESS' | 'FAIL' = dice >= 4 ? 'SUCCESS' : 'FAIL';

// AFTER (Phase 5 — import rollDice, apply MOVE-04 combined-score threshold):
import { rollDice } from './diceUtils.js';
// ...
const dice = rollDice();
const combined = computeCombinedScore(defender.tackling, dice, []);
const stealResult: 'SUCCESS' | 'FAIL' = combined >= 10 ? 'SUCCESS' : 'FAIL';
```

**No socket.io imports** (line 31 comment):

```typescript
// No socket.io imports — pure functions only (ARCH-01, established Phase 2/3 pattern).
```

**`lastDiceRoll` must be embedded in every new state return** — add to every `apply*` spread:

```typescript
return {
  ok: true,
  state: {
    ...state,
    // ... mutation fields ...
    lastDiceRoll: {
      rolls: [shooterDice, gkDice, handlingDice], // all dice pre-generated upfront
      context: 'SHOT_DUEL',
    },
  },
};
```

---

### `packages/server/src/gameHandlers.ts` (middleware, request-response) — EXTEND

**Analog:** itself — every existing handler in `registerGameHandlers` is the canonical pattern.

**Handler skeleton** (lines 94–123, any handler block):

```typescript
socket.on(ClientEvents.GAME_ROLL, () => {
  const { roomCode } = socket.data; // read socket.data, NEVER socket.rooms (Pitfall 2)
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

  room.isProcessing = true;
  try {
    if (room.gameState === null || !DICE_PHASES.has(room.gameState.phase)) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room); // D-06: snap-back
      return;
    }
    if (!isActivePlayer(socket, room)) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
      broadcastState(io, room);
      return;
    }
    // roll dice, call applyRoll, assign result
    const result = applyRoll(room.gameState, rollDice(), rollDice(), rollDice());
    if (!result.ok) {
      socket.emit(ServerEvents.GAME_ERROR, result.reason);
      broadcastState(io, room);
      return;
    }
    room.gameState = result.state;
    broadcastState(io, room); // ARCH-04: single broadcast entry point
  } finally {
    room.isProcessing = false; // MUST be in finally — never conditional (Pitfall 5)
  }
});
```

**`controlsGKTeam` helper** — new helper to add alongside existing `socketTeam`, `actingTeam`, `isActivePlayer`, `controlsAttackingTeam` (lines 47–78):

```typescript
// Pattern: same shape as existing helper functions — reads socket.data.playerSlot
// and compares to a team derived from state, never from socket.rooms.
function controlsGKTeam(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null || room.gameState.ball.carrierId === null) return false;
  const gkPiece = room.gameState.pieces.find((p) => p.id === room.gameState!.ball.carrierId);
  if (!gkPiece) return false;
  return socketTeam(socket) === gkPiece.teamId;
}
```

**`game:gk-restart` handler** — new event with payload validation:

```typescript
socket.on(ClientEvents.GAME_GK_RESTART, (choice: 'kick' | 'throw' | 'movement') => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5

  room.isProcessing = true;
  try {
    // Phase guard
    if (room.gameState === null || room.gameState.phase !== 'GK_RESTART') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    // Team guard — must be GK's team (not "active team")
    if (!controlsGKTeam(socket, room)) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
      broadcastState(io, room);
      return;
    }
    // Payload validation — never trust client input (V5 / ASVS)
    if (!['kick', 'throw', 'movement'].includes(choice)) {
      socket.emit(ServerEvents.GAME_ERROR, 'INVALID_CHOICE');
      broadcastState(io, room);
      return;
    }
    const result = applyGKRestart(room.gameState, choice, rollDice);
    if (!result.ok) {
      socket.emit(ServerEvents.GAME_ERROR, result.reason);
      broadcastState(io, room);
      return;
    }
    room.gameState = result.state;
    broadcastState(io, room); // ARCH-04
  } finally {
    room.isProcessing = false;
  }
});
```

**Import additions** — follow the existing import block pattern (lines 23–35):

```typescript
import {
  applyEndTurn,
  applyMove,
  applyStartMovement,
  applyUndo,
  applyRoll,
  applyGKRestart,
} from './gameEngine.js';
import { rollDice } from './diceUtils.js';
```

---

### `packages/shared/src/types.ts` (model) — EXTEND

**Analog:** itself — add two fields using existing field comment style.

**`highPass` addition to `PlayerPiece`** (after `aerialAbility` at line 15):

```typescript
export type PlayerPiece = {
  // ... existing fields ...
  aerialAbility: number;
  /**
   * D-04 (Phase 5): High Pass accuracy attribute.
   * Outfielders: meaningful value (3–8 by position/role).
   * GKs: 0 — GKs use High Pass mechanics for kicks but have low accuracy by design.
   */
  highPass: number;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
};
```

**`lastDiceRoll` addition to `GameState`** (after `pendingFreeMove` at line 118):

```typescript
export type GameState = {
  // ... existing fields ...
  pendingFreeMove?: { team: 'home' | 'away'; hexesAllowed: number } | null;
  /**
   * D-11 / Phase 5: Dice rolls from the most recent dice action.
   * Embedded in GameState so both clients see the rolls before rendering the outcome.
   * null when no dice have been rolled yet (KICK_OFF, LOBBY phases).
   * Context string values: 'PASS_ACCURACY' | 'SHOT_DUEL' | 'HEADING_DUEL' | 'LOOSE_BALL' | 'GK_KICK'
   */
  lastDiceRoll?: {
    rolls: number[]; // ordered dice values; length varies by context (1–3)
    context: string;
  } | null;
};
```

---

### `packages/shared/src/events.ts` (config) — EXTEND

**Analog:** itself — follow the `as const` object and interface extension pattern exactly (lines 7–15, 29–39).

**`GAME_GK_RESTART` addition:**

```typescript
export const ClientEvents = {
  // ... existing entries ...
  GAME_ROLL: 'game:roll', // already present
  GAME_GK_RESTART: 'game:gk-restart', // ADD
} as const;

export interface ClientToServerEvents {
  // ... existing entries ...
  [ClientEvents.GAME_ROLL]: () => void; // already present
  [ClientEvents.GAME_GK_RESTART]: (choice: 'kick' | 'throw' | 'movement') => void; // ADD
}
```

---

### `packages/shared/src/teams.ts` (config) — EXTEND

**Analog:** itself — each player object already follows the attribute block structure (lines 14–30 for first player).

**`highPass` insertion pattern** — add after `aerialAbility` on every player object:

```typescript
// GK example (home-0, lines 14–30):
{
  id: 'home-0',
  teamId: 'home',
  name: 'Home GK',
  role: 'GK',
  position: { q: 0, r: 7 },
  pace: 2, shooting: 1, tackling: 4, dribbling: 3, heading: 5,
  saving: 9, handling: 8, resilience: 7, aerialAbility: 8,
  highPass: 0,  // ADD: GKs have highPass: 0 per D-04
},

// DEF example (home-1, lines 32–46):
{
  // ... same attributes ...
  aerialAbility: 6,
  highPass: 4,  // ADD: DEF range 3–5 per RESEARCH.md Code Examples
},

// MID example:
{
  aerialAbility: 5,
  highPass: 6,  // ADD: MID range 5–7
},

// FWD example:
{
  aerialAbility: 5,
  highPass: 5,  // ADD: FWD range 4–6
},
```

**Note on `aerialAbility` and `handling` zero-value decision:** Per D-05 and D-06, outfielders should have `aerialAbility: 0` and `handling: 0`. However, existing `teams.ts` has non-zero values (4–7 for `aerialAbility`, 1 for `handling`) and `teams.test.ts` asserts `>= 1` for all attributes. The planner must decide: either (a) update outfielder values to 0 and update `teams.test.ts` assertion to allow 0 for role-specific attributes, or (b) leave existing values and only enforce the convention for new uses. Research recommends option (a) — update the test. Document in plan.

---

### `packages/shared/src/passValidator.ts` (utility, transform) — FIX

**Analog:** itself — the fix is surgical: one attribute name change on line 144.

**The exact change** (line 143–144):

```typescript
// BEFORE (incorrect — uses aerialAbility for HIGH pass):
// A1: assumed attribute mapping — verify against rulebook before Phase 4 live use
const attribute = passType === 'HIGH' ? piece.aerialAbility : piece.dribbling;

// AFTER (D-14 fix — uses highPass for HIGH pass):
// D-14 (Phase 5): HIGH pass uses highPass attribute, not aerialAbility.
const attribute = passType === 'HIGH' ? piece.highPass : piece.dribbling;
```

**Also update the file-level JSDoc comment** (line 13 — removes the incorrect A1 assumption note):

```typescript
// BEFORE: Attribute mapping (assumption A1 — flagged for Phase 4 verification before live use):
// - High Pass accuracy uses piece.aerialAbility
// AFTER:
// - High Pass accuracy uses piece.highPass (D-04, D-14 Phase 5 verified)
```

No changes to `AccuracyResult` union or `validatePass` — those are correct per D-15 and D-16.

---

### `packages/shared/src/shotValidator.ts` (utility, transform) — CHANGE

**Analog:** itself — the change is in the `ShotDuelResult` union (line 23–26) and one comparison line (line 70–71).

**`ShotDuelResult` union change** (lines 23–26):

```typescript
// BEFORE:
export type ShotDuelResult =
  | { outcome: 'GOAL' }
  | { outcome: 'MISS'; reason: 'AUTO_MISS' }
  | { outcome: 'SAVE'; needsHandlingCheck: true };

// AFTER (D-13 + D-17 — add LOOSE_BALL for ties):
export type ShotDuelResult =
  | { outcome: 'GOAL' }
  | { outcome: 'MISS'; reason: 'AUTO_MISS' }
  | { outcome: 'SAVE'; needsHandlingCheck: true }
  | { outcome: 'LOOSE_BALL' }; // D-13: tie → Loose Ball (replaces SAVE on equal scores)
```

**`validateShotDuel` comparison change** (lines 70–71):

```typescript
// BEFORE (strict > sends ties to SAVE):
if (shooterScore > gkScore) return { outcome: 'GOAL' };
return { outcome: 'SAVE', needsHandlingCheck: true };

// AFTER (D-13: explicit tie branch → LOOSE_BALL):
if (shooterScore > gkScore) return { outcome: 'GOAL' };
if (shooterScore === gkScore) return { outcome: 'LOOSE_BALL' }; // D-13: tie → Loose Ball
return { outcome: 'SAVE', needsHandlingCheck: true };
```

**Update file-level JSDoc** — remove the "ties go to the GK" comment in the function JSDoc (line 43).

---

### `packages/shared/src/shotValidator.test.ts` (test) — UPDATE

**Analog:** itself — only the tie test case must change (line 60–64).

**Change the tie test** (lines 60–64):

```typescript
// BEFORE:
it('ties go to the GK (SAVE) — equal scores → SAVE not GOAL', () => {
  const result = validateShotDuel(shooter, goalkeeper, 3, 3, [], []);
  expect(result.outcome).toBe('SAVE');
});

// AFTER (D-13 — ties produce LOOSE_BALL):
it('ties produce LOOSE_BALL — equal scores → LOOSE_BALL not SAVE (D-13)', () => {
  // shooter: 7+3=10 vs gk: 7+3=10 → tie → LOOSE_BALL
  const result = validateShotDuel(shooter, goalkeeper, 3, 3, [], []);
  expect(result.outcome).toBe('LOOSE_BALL');
});
```

**Add one new test** after the tie test:

```typescript
it('SAVE when gkScore > shooterScore (no tie — shooter clearly loses)', () => {
  // shooter: 7+2=9 vs gk: 7+3=10 → SAVE (gk wins)
  const result = validateShotDuel(shooter, goalkeeper, 2, 3, [], []);
  expect(result.outcome).toBe('SAVE');
  if (result.outcome === 'SAVE') expect(result.needsHandlingCheck).toBe(true);
});
```

**Also update `teams.test.ts`** when `highPass` is added to `PlayerPiece`:

```typescript
// BEFORE (line 4–14):
const ATTRIBUTES = [
  'pace',
  'shooting',
  'tackling',
  'dribbling',
  'heading',
  'saving',
  'handling',
  'resilience',
  'aerialAbility',
] as const;

// AFTER (add highPass):
const ATTRIBUTES = [
  'pace',
  'shooting',
  'tackling',
  'dribbling',
  'heading',
  'saving',
  'handling',
  'resilience',
  'aerialAbility',
  'highPass',
] as const;

// AND update the attribute range assertion to allow 0 for role-specific attributes:
// Old: expect(val, ...).toBeGreaterThanOrEqual(1);
// New: allow 0 for 'aerialAbility', 'handling', 'highPass' on non-GK roles
// Suggested refactor:
const ZERO_ALLOWED_FOR_ROLE: Partial<Record<(typeof ATTRIBUTES)[number], string[]>> = {
  aerialAbility: ['DEF', 'MID', 'FWD'],
  handling: ['DEF', 'MID', 'FWD'],
  highPass: ['GK'],
};
// In loop: const minVal = ZERO_ALLOWED_FOR_ROLE[attr]?.includes(player.role) ? 0 : 1;
```

---

### `packages/server/src/__tests__/diceUtils.test.ts` (test) — NEW FILE

**Analog:** `packages/server/src/__tests__/gameEngine.test.ts` — same import style, same describe/it/expect structure.

**Imports and structure pattern** (`gameEngine.test.ts` lines 1–9):

```typescript
import { describe, it, expect } from 'vitest';
import { rollDice } from '../diceUtils.js';

describe('rollDice', () => {
  it('returns an integer between 1 and 6 inclusive', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDice();
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  it('produces at least 3 distinct values across 20 rolls (statistical non-flaky)', () => {
    const values = new Set<number>();
    for (let i = 0; i < 20; i++) values.add(rollDice());
    expect(values.size).toBeGreaterThanOrEqual(3);
  });
});
```

---

## Shared Patterns

### isProcessing Mutex

**Source:** `packages/server/src/gameHandlers.ts` lines 98–122 (any handler block)
**Apply to:** Both new handlers (`game:roll`, `game:gk-restart`)

```typescript
if (!room || room.isProcessing) return; // SC-5: drop silently
room.isProcessing = true;
try {
  // ... handler body ...
} finally {
  room.isProcessing = false; // MUST be in finally — Pitfall 5 (STATE.md)
}
```

### Snap-back Broadcast on Rejection

**Source:** `packages/server/src/gameHandlers.ts` lines 103–105
**Apply to:** Every guard rejection inside new handlers

```typescript
socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
broadcastState(io, room); // D-06: snap-back ensures clients are in sync even after rejection
return;
```

### Named Exports, No Defaults

**Source:** All files in `packages/shared/src/` and `packages/server/src/`
**Apply to:** All new functions (`rollDice`, `applyRoll`, `applyGKRestart`)

```typescript
// Always: export function foo() { ... }
// Never:  export default function foo() { ... }
```

### `.js` Extensions on Local Imports

**Source:** `packages/shared/src/passValidator.ts` lines 18–20, `packages/shared/src/shotValidator.ts` line 13
**Apply to:** `diceUtils.ts` imports in `gameHandlers.ts`, `gameEngine.ts`

```typescript
import { rollDice } from './diceUtils.js'; // .js extension required — NodeNext resolution
import { applyRoll, applyGKRestart } from './gameEngine.js';
```

### Dice Injection into Validators

**Source:** Established pattern — `validateShotDuel`, `validatePassAccuracy`, `computeLooseBall` all accept dice as parameters
**Apply to:** All `apply*` functions in `gameEngine.ts`

```typescript
// All dice generated BEFORE calling any validator:
const shooterDice = rollDice();
const gkDice = rollDice();
const handlingDice = rollDice(); // pre-generate even if path may not reach handling check
// Then pass as arguments:
const result = validateShotDuel(shooter, gk, shooterDice, gkDice, [], [gkPenalty]);
```

### `computeLooseBall` (do not re-implement)

**Source:** `packages/shared/src/scoreUtils.ts` lines 69–78
**Apply to:** All Loose Ball destination calculations in `applyRoll`, `applyShot`, `applyGKRestart`

```typescript
import { computeLooseBall } from '@counter-attack/shared';
// ...
const landingHex = computeLooseBall(
  incidentHex,
  directionDice as 1 | 2 | 3 | 4 | 5 | 6,
  distanceDice as 1 | 2 | 3 | 4 | 5 | 6,
);
// Non-null assertion not needed — the literal union guards the index lookup inside the function
```

### `computeCombinedScore` (do not inline)

**Source:** `packages/shared/src/scoreUtils.ts` lines 27–36
**Apply to:** Every attribute + dice calculation in new `apply*` functions

```typescript
import { computeCombinedScore } from '@counter-attack/shared';
const shooterScore = computeCombinedScore(shooter.shooting, shooterDice, shooterPenalties);
// Handles DICE-04 -2 cap automatically — never use inline attribute + dice + penalty math
```

### broadcastState (single entry point)

**Source:** `packages/server/src/roomStore.ts` line 214
**Apply to:** Every new handler — both success and rejection paths that update state

```typescript
import { broadcastState } from './roomStore.js';
// ...
broadcastState(io, room); // ARCH-04 — never io.to(roomCode).emit() directly
```

---

## No Analog Found

All Phase 5 files have strong analogs in the existing codebase. No files require falling back to RESEARCH.md patterns exclusively.

The closest to "no analog" is `diceUtils.ts` as a standalone new file, but the crypto import pattern and file conventions are directly observable in `gameEngine.ts`.

---

## Metadata

**Analog search scope:** `packages/server/src/`, `packages/shared/src/`, `packages/server/src/__tests__/`, `packages/shared/src/*.test.ts`
**Files read:** 14 source files + 4 test files
**Pattern extraction date:** 2026-05-30
