# Phase 10: Remaining Action Flows + Tech Debt - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 10 files to modify (no net-new files)
**Analogs found:** 10 / 10

---

## File Classification

| Modified File                                             | Role         | Data Flow        | Closest Analog                                                                 | Match Quality |
| --------------------------------------------------------- | ------------ | ---------------- | ------------------------------------------------------------------------------ | ------------- |
| `packages/shared/src/types.ts`                            | model/config | transform        | itself (extend in place)                                                       | exact         |
| `packages/shared/src/events.ts`                           | config       | request-response | itself (extend in place)                                                       | exact         |
| `packages/server/src/gameEngine.ts`                       | service      | event-driven     | itself (`applySnapshot`, `applyGKRestart`)                                     | exact         |
| `packages/server/src/gameHandlers.ts`                     | controller   | event-driven     | itself (`GAME_SNAPSHOT`, `GAME_HEADER_CONTESTANT`, `HIGH_PASS_MOVEMENT` block) | exact         |
| `packages/client/src/components/ActionPanel.tsx`          | component    | request-response | itself (`HIGH_PASS_MOVEMENT` block, PASS phase three-step flow)                | exact         |
| `packages/client/src/store/useGameStore.ts`               | store        | request-response | itself (`emitSnapshot`, `emitHeaderContestant`)                                | exact         |
| `packages/client/src/components/ActionLog.tsx`            | component    | transform        | itself (`STANDARD_PASS`, `SHOT_ATTEMPT` cases)                                 | exact         |
| `packages/server/src/__tests__/gameEngine.phase8.test.ts` | test         | batch            | itself                                                                         | exact         |
| `packages/server/src/__tests__/gameHandlers.test.ts`      | test         | batch            | itself                                                                         | exact         |
| `packages/server/src/__tests__/game.integration.test.ts`  | test         | batch            | itself                                                                         | exact         |

---

## Pattern Assignments

### `packages/shared/src/types.ts` (model, transform)

**Analog:** itself

**GamePhase union — current pattern** (lines 170–184):

```typescript
export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
  | 'KICK_OFF_SETUP'
  | 'MOVEMENT'
  | 'PASS' // ← rename to 'ACTION'
  | 'SHOT'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'LOOSE_BALL'
  | 'HIGH_PASS_MOVEMENT'
  | 'GK_RESTART'
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'REPLAY';
```

**Phase 10 additions — copy this pattern:**

```typescript
export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
  | 'KICK_OFF_SETUP'
  | 'MOVEMENT'
  | 'ACTION' // renamed from 'PASS'
  | 'SHOT_DECLARED' // new: shot declared, awaiting GK dive
  | 'GK_DIVING' // new: GK's team repositions GK interactively
  | 'SNAP_DEFLECT' // new: opponent moves 1 player before snapshot resolves
  | 'SHOT'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'LOOSE_BALL'
  | 'HIGH_PASS_MOVEMENT'
  | 'GK_RESTART'
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'REPLAY';
```

**GameState field addition pattern — follow existing optional field style** (lines 239–286):

```typescript
// Existing optional field examples to copy style from:
pendingFreeMove?: { team: 'home' | 'away'; hexesAllowed: number } | null;
highPassCarrierId?: string | null;
highPassMovedPieceId?: string | null;
highPassPaceUsed?: number;
highPassMovementSlot?: 'ATTACKER' | 'DEFENDER' | null;
```

New fields to add using same optional pattern:

```typescript
/** Phase 10 HEAD-03: target hex selected by header attacker; null outside HEADER phase. */
headerTargetHex?: HexCoord | null;
/** Phase 10 SHOT_DECLARED: goal hex the shooter declared. */
shotTargetHex?: HexCoord | null;
/** Phase 10 GK_DIVING: GK's current position during GK_DIVING phase. */
gkDivePosition?: HexCoord | null;
/** Phase 10 D-29: piece IDs that already attempted a steal this movement phase. */
stealAttemptedByIds?: readonly string[];
/** Phase 10 D-29: piece IDs that already attempted a tackle this movement phase. */
tackleAttemptedByIds?: readonly string[];
```

---

### `packages/shared/src/events.ts` (config, request-response)

**Analog:** itself

**ClientEvents pattern to extend** (lines 7–38):

```typescript
export const ClientEvents = {
  // existing...
  GAME_HEADER_CONTESTANT: 'game:header-contestant',
} as const;
```

New entries follow the same `GAME_*: 'game:*'` pattern:

```typescript
/** Phase 10: GK repositions during GK_DIVING phase (up to 3 hexes parallel to goal line). */
GAME_GK_DIVE: 'game:gk-dive',
/** Phase 10: Attacker selects target hex during HEADER phase (HEAD-03). */
GAME_HEADER_TARGET: 'game:header-target',
```

**ClientToServerEvents interface pattern** (lines 52–91):

```typescript
// Existing typed entry to copy style from:
[ClientEvents.GAME_HEADER_CONTESTANT]: (pieceIds: string[] | null) => void;
[ClientEvents.GAME_SHOT]: (targetHex: HexCoord) => void;
```

New entries:

```typescript
/** Phase 10: GK dive hex during GK_DIVING phase. */
[ClientEvents.GAME_GK_DIVE]: (to: HexCoord) => void;
/** Phase 10: Header target hex selection during HEADER phase (HEAD-03). */
[ClientEvents.GAME_HEADER_TARGET]: (targetHex: HexCoord) => void;
```

---

### `packages/server/src/gameEngine.ts` (service, event-driven)

**Analog:** `applySnapshot` (lines 1654–1723) and `applyGKRestart` (lines 1496–1620) and `applyStartMovement` (lines 157–189)

**Engine function signature pattern** — all engine functions are pure, return discriminated unions, pre-validate phase, never call `rollDice()`:

```typescript
// applySnapshot pattern (lines 1625–1643, 1654):
export type ApplySnapshotResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'INVALID_SEQUENCE' | 'NOT_IN_PENALTY_AREA' }
  | { ok: true; state: GameState };

export function applySnapshot(state: GameState): ApplySnapshotResult {
  if (state.lastActionType !== null) {
    const eligible = ELIGIBLE_NEXT_ACTIONS[state.lastActionType];
    if (!eligible.has('SNAPSHOT')) {
      return { ok: false, reason: 'INVALID_SEQUENCE' };
    }
  }
  // ... phase guard ...
  return {
    ok: true,
    state: {
      ...state,
      phase: 'SHOT',
      lastActionType: 'SNAPSHOT',
      snapshotPenalty: true,
    },
  };
}
```

**New engine functions to add — follow this exact pattern:**

`applyDeclareShot(state, goalHex)`:

- Phase guard: `state.phase !== 'ACTION'` → `{ ok: false, reason: 'WRONG_PHASE' }`
- Sequence guard: `ELIGIBLE_NEXT_ACTIONS[lastActionType].has('SHOT')` check
- Validate goalHex is a goal-line hex for attackingTeam (use `PITCH_REGIONS`)
- Return transition to `SHOT_DECLARED` then immediately `GK_DIVING`
- Store `shotTargetHex: goalHex` in state

`applyGKDive(state, to)`:

- Phase guard: `state.phase !== 'GK_DIVING'`
- Piece guard: only GK piece allowed (piece with `role === 'GK'` on GK team)
- Direction guard: `to.q === gk.position.q` (parallel to goal line, constant q)
- Distance guard: cumulative dive distance ≤ 3 hexes (use `gkDivePosition` tracking)
- Pitch boundary: `PITCH_HEXES.some(h => h.q === to.q && h.r === to.r)`
- Update `gkDivePosition: to`

`applyDeclareHeaderTarget(state, targetHex)`:

- Phase guard: `state.phase !== 'HEADER'`
- Validate `headerConfirmed?.home && headerConfirmed?.away` (both teams confirmed)
- Validate targetHex is in `PITCH_HEXES`
- If goal-line hex (`targetHex.q === 36` for home attack, `targetHex.q === 0` for away attack, `r ∈ [10..16]`) → set `headerTargetHex`, stay in HEADER for duel
- Return `{ ok: true, state: { ...state, headerTargetHex: targetHex } }`

**D-17 WR-02 fix — intermediate slot lastActionType reset** (lines 588–599, `applyEndTurn`):

Current buggy pattern (non-ATTACKER_2 return does NOT reset lastActionType):

```typescript
return {
  ok: true,
  state: {
    ...state, // spreads lastActionType from previous slot — WRONG
    phase: nextPhase,
    movementSlot: nextSlot,
    activeTeam: nextActiveTeam,
    eventLog: [...state.eventLog, slotAdvanceEvent],
    movedPieceIds: [...state.movedPieceIds, ...lockedOnEndSlot],
    paceUsedByPieceId: {},
  },
};
```

Fixed: add `lastActionType: 'MOVEMENT_PHASE'` to match the ATTACKER_2→null path behavior.

**applyStartMovement — add cleared lists for D-29** (lines 174–188):

```typescript
return {
  ok: true,
  state: {
    ...state,
    phase: 'MOVEMENT',
    movementSlot: 'ATTACKER_4',
    activeTeam: state.attackingTeam,
    ball: newBall,
    eventLog: state.eventLog,
    contestedPieceIds: [],
    stealAttemptedByIds: [], // D-29: clear per-phase steal tracking
    tackleAttemptedByIds: [], // D-29: clear per-phase tackle tracking
  },
};
```

**D-22 GOAL eventLog fix — append GOAL event to SHOT branch GOAL return:**

```typescript
// In applyRoll SHOT branch GOAL case, add to return:
eventLog: [
  ...state.eventLog,
  { type: 'GOAL' as const, scoringTeam: state.attackingTeam, timestamp: Date.now() },
],
```

---

### `packages/server/src/gameHandlers.ts` (controller, event-driven)

**Analog:** `GAME_SNAPSHOT` handler (lines 1011–1041) and `HIGH_PASS_MOVEMENT` block in `GAME_MOVE` (lines 255–316) and `GAME_HEADER_CONTESTANT` (lines 1115–1183)

**Standard handler skeleton — mandatory pattern for every new handler:**

```typescript
socket.on(ClientEvents.GAME_GK_DIVE, (to: HexCoord) => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

  room.isProcessing = true;
  try {
    // 1. Null-state guard
    if (room.gameState === null) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room); // snap-back
      return;
    }
    // 2. Phase guard
    if (room.gameState.phase !== 'GK_DIVING') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    // 3. HexCoord payload validation (ASVS V5 — mirror GAME_SHOT T-07-12)
    if (
      typeof to !== 'object' ||
      to === null ||
      typeof to.q !== 'number' ||
      typeof to.r !== 'number'
    ) {
      socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
      broadcastState(io, room);
      return;
    }
    // 4. Team guard — GK team only (mirror controlsGKTeam pattern lines 120–125)
    if (!controlsGKTeam(socket, room)) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
      broadcastState(io, room);
      return;
    }
    // 5. Call pure engine function
    const result = applyGKDive(room.gameState, to);
    if (!result.ok) {
      socket.emit(ServerEvents.GAME_ERROR, result.reason);
      broadcastState(io, room); // snap-back
      return;
    }
    room.gameState = result.state;
    broadcastState(io, room); // ARCH-04
  } finally {
    room.isProcessing = false; // MUST be in finally — Pitfall 5
  }
});
```

**GK End Turn (auto-resolve shot) — follows HIGH_PASS_MOVEMENT end-turn pattern** (lines 365–426):

```typescript
// In GAME_END_TURN handler, add GK_DIVING phase block before MOVEMENT guard:
if (room.gameState.phase === 'GK_DIVING') {
  if (!controlsGKTeam(socket, room)) {
    socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
    broadcastState(io, room);
    return;
  }
  // Pre-generate all defender deflection dice + shot duel dice before calling engine
  // (same as how HIGH_PASS_MOVEMENT pre-generates d1/d2/d3 before calling applyRoll)
  const defenderDice = preGenerateDefenderDice(room.gameState); // new helper
  const d1 = rollDice(); // shooter die
  const d2 = rollDice(); // GK die
  const d3 = rollDice(); // handling die
  const result = applyRoll(stateForShotResolution, d1, d2, d3, ...defenderDice);
  // ...handle result
}
```

**SNAP_DEFLECT in GAME_MOVE — add guard block before MOVEMENT guard** (after HIGH_PASS_MOVEMENT block, line 317):

```typescript
// Pattern mirrors HIGH_PASS_MOVEMENT block (lines 255–316) exactly but with:
// - activeTeam = defending team (opponent of attackingTeam)
// - only 1 piece per team (lock to first moved piece)
// - max 2 hexes (snapDeflectPaceUsed >= 2)
// - no ball movement
if (room.gameState.phase === 'SNAP_DEFLECT') {
  if (!isActivePlayer(socket, room)) { ... }
  // Lock to first piece moved (snapDeflectMovedPieceId)
  // Enforce pace cap (snapDeflectPaceUsed >= 2)
  // Enforce adjacency (hexDistance === 1)
  // Enforce pitch boundary (PITCH_HEXES)
  // Enforce no occupied hex
  // Update state + broadcastState
}
```

**GAME_SHOT rework — change phase guard from 'SHOT' to 'ACTION'** (lines 750–785):

```typescript
// Before (line 759):
if (room.gameState === null || room.gameState.phase !== 'SHOT') {

// After (D-02):
if (room.gameState === null || room.gameState.phase !== 'ACTION') {
// Then call applyDeclareShot(room.gameState, targetHex) to transition to SHOT_DECLARED → GK_DIVING
// and broadcastState (unlike current version which intentionally doesn't broadcast)
```

**D-15 CR-01 fix — startReplayStream stale reference** (lines 145–170):

```typescript
// Before (line 151–168): room captured in closure is stale
setTimeout(() => {
  let idx = 0;
  room.replayTimer = setInterval(() => { ... }, 1000); // room = stale
}, 3000);

// After: re-fetch live room inside setTimeout callback
setTimeout(() => {
  const liveRoom = getRoom(room.roomCode); // re-fetch
  if (!liveRoom || liveRoom.gameState === null) return; // exit if deleted
  const frames = buildReplayFrames(liveRoom.gameState);
  const replayTotal = frames.length;
  let idx = 0;
  liveRoom.replayTimer = setInterval(() => {
    if (idx >= frames.length) {
      clearInterval(liveRoom.replayTimer!);
      liveRoom.replayTimer = null;
      return;
    }
    const frame = frames[idx++]!;
    const replayFrame: GameState = { ...frame, replayIndex: idx, replayTotal };
    io.to(liveRoom.roomCode).emit(ServerEvents.GAME_STATE, replayFrame);
  }, 1000);
}, 3000);
```

**DICE_PHASES constant — rename 'PASS' → 'ACTION'** (line 65):

```typescript
// Before:
const DICE_PHASES = new Set<string>(['KICK_OFF', 'PASS', 'SHOT', 'HEADER', 'LOOSE_BALL']);
// After:
const DICE_PHASES = new Set<string>(['KICK_OFF', 'ACTION', 'SHOT', 'HEADER', 'LOOSE_BALL']);
```

**GAME_HEADER_TARGET handler — both-teams-confirmed guard pattern** (copy from GAME_HEADER_CONTESTANT lines 1160–1176):

```typescript
// Both teams already confirmed check (same auto-roll guard pattern):
if (room.gameState.headerConfirmed?.home && room.gameState.headerConfirmed?.away) {
  // only then accept target hex
}
// isActivePlayer guard (attacker only selects target):
if (!isActivePlayer(socket, room)) { ... }
```

---

### `packages/client/src/components/ActionPanel.tsx` (component, request-response)

**Analog:** `HIGH_PASS_MOVEMENT` phase block (lines 82–104) and PASS phase three-step flow (lines 150–276)

**Interactive repositioning phase UI pattern — copy HIGH_PASS_MOVEMENT block** (lines 82–104):

```tsx
// GK_DIVING and SNAP_DEFLECT follow this exact structure:
if (phase === 'HIGH_PASS_MOVEMENT') {
  if (myTeam === null) return null;
  if (!isActivePlayer) {
    return (
      <div className={styles.panel}>
        <span className={styles.phaseLabel}>Opponent is repositioning — wait...</span>
      </div>
    );
  }
  return (
    <div className={styles.panel}>
      <span className={styles.phaseLabel}>Reposition a player for the header (up to 3 hexes)</span>
      <button className={styles.ctaButton} onClick={emitEndTurn}>
        End Turn
      </button>
      {gameError && <span className={styles.errorText}>{gameError}</span>}
    </div>
  );
}
```

For `GK_DIVING`: adapt label to "Reposition GK (up to 3 hexes parallel to goal line)"; active player = GK team (use `isGKTeam` derived from `carrierId` lookup — lines 140–142).
For `SNAP_DEFLECT`: adapt label to "Move a player to deflect snapshot (up to 2 hexes)"; active player = defending team (opponent of `attackingTeam`).

**HEADER target-hex selection step — new step added after both teams confirm** (insert after HEADER confirm block lines 112–135):

```tsx
// Add to HEADER phase block: after both teams confirm, attacker clicks a target hex
if (phase === 'HEADER') {
  // ... existing confirm UI ...
  // After headerConfirmed?.home && headerConfirmed?.away:
  if (headerConfirmed?.home && headerConfirmed?.away && isActivePlayer) {
    return (
      <div className={styles.panel}>
        <span className={styles.phaseLabel}>Click a target hex for the header</span>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }
}
```

HexGrid click wires to `emitHeaderTarget` store action.

**Shoot button — two-step flow replacing disabled button** (lines 221–237):

```tsx
// Current (disabled):
{
  (eligible.has('SNAPSHOT') || eligible.has('SHOT')) &&
    (() => {
      // ...
      return dist <= 11 ? (
        <button className={styles.ctaButton} disabled>
          Shoot
        </button>
      ) : null;
    })();
}

// Phase 10 replacement — two-step flow mirroring pass type selection:
// Step 1: "Shoot" button sets shootingMode=true in store (like setSelectedPassType)
// Step 2: board highlights goal hexes; user clicks one → emitDeclareShot(hex)
// No Roll Dice step — server auto-resolves after GK dives
{
  eligible.has('SHOT') && dist <= 11 && (
    <button className={styles.ctaButton} onClick={() => setShootingMode(true)}>
      Shoot
    </button>
  );
}

// Snapshot button — was permanently disabled, now wire to emitSnapshot (D-10):
{
  eligible.has('SNAPSHOT') && dist <= 6 && (
    <button className={styles.ctaButton} onClick={emitSnapshot}>
      Snapshot
    </button>
  );
}
```

**PASS → ACTION rename in ActionPanel** (lines 15, 69, 150):

```tsx
// line 15: DICE_PHASES
const DICE_PHASES = new Set(['SHOT'] as const); // 'PASS' not in client DICE_PHASES, no change needed

// line 69:
if (phase === 'PASS' && lastActionType === 'HEADER' ...) → 'ACTION'

// line 150:
if (phase === 'PASS' || phase === 'KICK_OFF') → if (phase === 'ACTION' || phase === 'KICK_OFF')

// line 152:
if (phase === 'PASS' && carrierId === null) → if (phase === 'ACTION' && carrierId === null)
```

---

### `packages/client/src/store/useGameStore.ts` (store, request-response)

**Analog:** `emitSnapshot` (line 507) and `emitHeaderContestant` (lines 263–264)

**Simple zero-arg emit pattern** (lines 507–510):

```typescript
emitSnapshot: () => {
  socket.emit(ClientEvents.GAME_SNAPSHOT);
},
```

Copy this pattern for `emitDeclareShot` (with HexCoord arg), `emitGKDive` (with HexCoord arg), `emitHeaderTarget` (with HexCoord arg):

```typescript
emitDeclareShot: (goalHex: HexCoord) => {
  socket.emit(ClientEvents.GAME_SHOT, goalHex); // reuses GAME_SHOT event
},
emitGKDive: (to: HexCoord) => {
  socket.emit(ClientEvents.GAME_GK_DIVE, to);
},
emitHeaderTarget: (targetHex: HexCoord) => {
  socket.emit(ClientEvents.GAME_HEADER_TARGET, targetHex);
},
```

**Store state fields to add** (after `headerContestantIds: string[]` line 62):

```typescript
/** Phase 10: true when shooter has clicked "Shoot" and is selecting a goal hex. */
shootingMode: boolean;
/** Phase 10: goal hex selected by shooter before emit. */
shootTargetHex: HexCoord | null;
```

Cleared in `setGameState` alongside `selectedPassType` and `passTargetHex` clearing.

**PASS → ACTION rename in useGameStore** — search for `'PASS'` string literals in phase comparisons and update. The `selectedPassType` state field name stays (it refers to pass action type, not GamePhase value).

---

### `packages/client/src/components/ActionLog.tsx` (component, transform)

**Analog:** `STANDARD_PASS` case (lines 204–209) and `GOAL` case (lines 195–201)

**D-27 fix — pass log entries missing team colour** (lines 204–216):

```tsx
// Current STANDARD_PASS case (lines 204–209):
case 'STANDARD_PASS':
  return {
    prefix: event.accurate ? '[PASS ✓]' : '[PASS ✗]',
    prefixColor: null,   // ← BUG: null means no colour
    content: ` Standard  ${event.from.q},${event.from.r} → ...`,
    isGoal: false,
  };

// Fix: derive team colour same as SHOT_ATTEMPT (lines 233–238) or GOAL (lines 195–201):
// SHOT_ATTEMPT uses: prefixColor: event.shooterId ? pieceColorOf(event.shooterId) : null
// GOAL uses: prefixColor: event.scoringTeam === 'home' ? HOME_COLOR : AWAY_COLOR

// For STANDARD_PASS/FIRST_TIME_PASS events, the ActionEvent type doesn't carry a
// passerId — add one to ActionEvent or derive from attackingTeam stored in GameState.
// Simplest fix: add passerId to STANDARD_PASS and FIRST_TIME_PASS ActionEvent types
// and use pieceColorOf(passerId) — same as HIGH_PASS (line 222):
case 'STANDARD_PASS':
  return {
    prefix: event.accurate ? '[PASS ✓]' : '[PASS ✗]',
    prefixColor: event.passerId ? pieceColorOf(event.passerId) : null, // D-27 fix
    content: ` Standard  ${event.from.q},${event.from.r} → ${event.to.q},${event.to.r}`,
    isGoal: false,
  };
```

---

### `packages/server/src/__tests__/gameEngine.phase8.test.ts` (test, batch)

**Analog:** itself — all Phase 10 engine tests go in a new `gameEngine.phase10.test.ts` following the same structure

**Test file structure pattern** (lines 1–28):

```typescript
/**
 * Phase 10 game engine tests.
 * Covers: SNAP_DEFLECT transition, HEAD-03 goal-line redirect, D-22 GOAL eventLog,
 * D-21 pickWinner determinism, D-17 lastActionType reset, D-23 HEADER LOOSE_BALL
 */
import { describe, it, expect } from 'vitest';
import {
  applyEndTurn,
  applyRoll,
  applyDeclareShot, // new
  applyGKDive, // new
  applyDeclareHeaderTarget, // new
  applyStartMovement,
} from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';
```

**Fixture pattern** (lines 35–80):

```typescript
const homeFwd: PlayerPiece = {
  id: 'home-fwd',
  teamId: 'home',
  name: 'Home FWD',
  role: 'FWD',
  position: { q: 32, r: 12 }, // in awayPenaltyArea
  pace: 9,
  shooting: 9,
  tackling: 1,
  dribbling: 8,
  heading: 6,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 0,
  highPass: 5,
};
// Pattern: use real HOME_SQUAD/AWAY_SQUAD piece IDs for integration tests (D-25)
```

---

### `packages/server/src/__tests__/game.integration.test.ts` (test, batch)

**D-25 fix pattern** — replace Phase-2-era hardcoded coords with real squad positions.

The 3 failing tests (D-10 undo reversal, D-09 UNDO_LOCKED after SLOT_ADVANCE, PASS-phase roll) use hardcoded piece IDs and positions from when the board was a placeholder grid. Replace with actual `HOME_SQUAD`/`AWAY_SQUAD` piece IDs imported from the server's squad definitions and their real positions on the 37×26 board. The fix is to find the squad definition file, import it, and use real positions rather than `{ q: 2, r: 2 }` style placeholders.

---

## Shared Patterns

### isProcessing Mutex (SC-5)

**Source:** `packages/server/src/gameHandlers.ts` lines 244–343 (GAME_MOVE handler)
**Apply to:** All new handlers (`GAME_GK_DIVE`, `GAME_HEADER_TARGET`, reworked `GAME_SHOT`)

```typescript
if (!room || room.isProcessing) return; // SC-5: drop duplicate silently
room.isProcessing = true;
try {
  // handler body
} finally {
  room.isProcessing = false; // MUST be in finally
}
```

### broadcastState on All Error Paths (ARCH-04)

**Source:** `packages/server/src/gameHandlers.ts` lines 255–316 (HIGH_PASS_MOVEMENT block)
**Apply to:** Every `socket.emit(ServerEvents.GAME_ERROR, ...)` call in new handlers

```typescript
socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
broadcastState(io, room); // snap-back — D-24 pattern
return;
```

**Exception:** The old `GAME_SHOT` handler intentionally omits broadcastState (line 761 comment). The reworked version MUST add broadcastState since it now transitions state.

### HexCoord Payload Validation (ASVS V5)

**Source:** `packages/server/src/gameHandlers.ts` lines 769–778 (GAME_SHOT handler)
**Apply to:** All new handlers that accept a HexCoord payload

```typescript
if (
  typeof targetHex !== 'object' ||
  targetHex === null ||
  typeof targetHex.q !== 'number' ||
  typeof targetHex.r !== 'number'
) {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
  broadcastState(io, room);
  return;
}
```

### Dice Pre-generation in Handler (ARCH-01)

**Source:** `packages/server/src/gameHandlers.ts` lines 1087–1091 (GAME_HEADER) and lines 400–402 (HIGH_PASS_MOVEMENT end-turn)
**Apply to:** GK_DIVING end-turn handler (auto-resolve shot) and SNAP_DEFLECT end-turn

```typescript
// Pre-generate dice in handler (I/O layer) — engine must stay pure (ARCH-01)
const d1 = rollDice();
const d2 = rollDice();
const d3 = rollDice();
const result = applyRoll(room.gameState, d1, d2, d3);
```

### Engine Pure Function Result Pattern

**Source:** `packages/server/src/gameEngine.ts` lines 1625–1641 (`ApplySnapshotResult` type)
**Apply to:** All new engine functions (`applyDeclareShot`, `applyGKDive`, `applyDeclareHeaderTarget`)

```typescript
export type ApplyDeclareShotResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'INVALID_SEQUENCE' | 'INVALID_TARGET' }
  | { ok: true; state: GameState };
```

### socketTeam / controlsGKTeam Authorization

**Source:** `packages/server/src/gameHandlers.ts` lines 74–125
**Apply to:** `GAME_GK_DIVE` handler (GK team guard), `GAME_HEADER_TARGET` (attacker guard)

```typescript
// GK team guard (for GAME_GK_DIVE):
function controlsGKTeam(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null || room.gameState.ball.carrierId === null) return false;
  const gkPiece = room.gameState.pieces.find((p) => p.id === room.gameState!.ball.carrierId);
  if (!gkPiece) return false;
  return socketTeam(socket) === gkPiece.teamId;
}
// Attacker guard (for GAME_HEADER_TARGET):
function controlsAttackingTeam(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null) return false;
  return socketTeam(socket) === room.gameState.attackingTeam;
}
```

### 'PASS' → 'ACTION' Rename Verification Command

**After rename, run:**

```bash
grep -r "=== 'PASS'\|=== \"PASS\"\|: 'PASS'\|: \"PASS\"\|phase.*PASS\|PASS.*phase" packages/
# Must return zero results except in comments and test descriptions
pnpm -r exec tsc --noEmit  # authoritative completeness check
```

---

## No Analog Found

All files modified in Phase 10 have direct analogs within themselves (existing code being extended). No net-new files require patterns from external analogs.

---

## Metadata

**Analog search scope:** `packages/server/src/`, `packages/client/src/`, `packages/shared/src/`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-06-09
