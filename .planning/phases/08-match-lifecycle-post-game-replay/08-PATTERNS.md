# Phase 8: Match Lifecycle + Post-Game Replay - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File                                                      | Role       | Data Flow        | Closest Analog                                              | Match Quality |
| ---------------------------------------------------------------------- | ---------- | ---------------- | ----------------------------------------------------------- | ------------- |
| `packages/shared/src/types.ts`                                         | model      | transform        | `packages/shared/src/types.ts` (self — extend)              | exact         |
| `packages/shared/src/events.ts`                                        | config     | event-driven     | `packages/shared/src/events.ts` (self — extend)             | exact         |
| `packages/shared/src/actionSequence.ts`                                | utility    | transform        | `packages/shared/src/snapshotValidator.ts`                  | role-match    |
| `packages/shared/src/index.ts`                                         | config     | transform        | `packages/shared/src/index.ts` (self — extend)              | exact         |
| `packages/server/src/gameEngine.ts`                                    | service    | event-driven     | `packages/server/src/gameEngine.ts` (self — extend)         | exact         |
| `packages/server/src/roomStore.ts`                                     | store      | CRUD             | `packages/server/src/roomStore.ts` (self — extend)          | exact         |
| `packages/server/src/gameHandlers.ts`                                  | middleware | request-response | `packages/server/src/gameHandlers.ts` (self — extend)       | exact         |
| `packages/client/src/App.tsx`                                          | controller | event-driven     | `packages/client/src/App.tsx` (self — extend)               | exact         |
| `packages/client/src/store/useGameStore.ts`                            | store      | event-driven     | `packages/client/src/store/useGameStore.ts` (self — extend) | exact         |
| `packages/client/src/components/KickOffSetupPanel.tsx` + `.module.css` | component  | request-response | `packages/client/src/components/ActionPanel.tsx`            | exact         |
| `packages/client/src/components/HalfTimeScreen.tsx` + `.module.css`    | component  | request-response | `packages/client/src/components/LobbyScreen.tsx`            | exact         |
| `packages/client/src/components/FullTimeScreen.tsx` + `.module.css`    | component  | request-response | `packages/client/src/components/LobbyScreen.tsx`            | exact         |
| `packages/client/src/components/ReplayPanel.tsx` + `.module.css`       | component  | event-driven     | `packages/client/src/components/ActionPanel.tsx`            | role-match    |
| `packages/server/src/__tests__/gameEngine.phase8.test.ts`              | test       | CRUD             | `packages/server/src/__tests__/gameEngine.test.ts`          | exact         |

---

## Pattern Assignments

### `packages/shared/src/types.ts` (model, transform — extend existing)

**Analog:** `packages/shared/src/types.ts` (self)

**Existing `ActionEventType` union** (lines 49–55) — extend by appending new literals:

```typescript
export type ActionEventType =
  | 'MOVE'
  | 'SLOT_ADVANCE'
  | 'DICE_ROLL'
  | 'STEAL_ATTEMPT'
  | 'GOAL'
  | 'KICK_OFF';
// Phase 8 appends: 'HIGH_PASS' | 'LONG_BALL' | 'STANDARD_PASS' | 'FIRST_TIME_PASS'
//                  | 'SHOT_ATTEMPT' | 'SNAPSHOT' | 'HALF_TIME' | 'FULL_TIME'
```

**Existing `ActionEvent` discriminated union** (lines 62–75) — append new member shapes matching the existing style (`type` literal + typed payload fields + `timestamp: number`):

```typescript
// Existing member as the copy template:
| { type: 'GOAL'; scoringTeam: 'home' | 'away'; timestamp: number }
// New members follow same shape:
| { type: 'HIGH_PASS';     from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
| { type: 'LONG_BALL';     from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
| { type: 'STANDARD_PASS'; from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
| { type: 'FIRST_TIME_PASS'; from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
| { type: 'SHOT_ATTEMPT';  shooterId: string; targetHex: HexCoord; outcome: 'GOAL' | 'MISS' | 'SAVE' | 'LOOSE_BALL'; timestamp: number }
| { type: 'SNAPSHOT';      shooterId: string; timestamp: number }
| { type: 'HALF_TIME';     half: 1; score: { home: number; away: number }; timestamp: number }
| { type: 'FULL_TIME';     score: { home: number; away: number }; timestamp: number }
```

**Existing `GamePhase` union** (lines 77–89) — add `'KICK_OFF_SETUP'` (currently absent, confirmed by inspection):

```typescript
export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
  | 'KICK_OFF_SETUP' // NEW — add here
  | 'MOVEMENT';
// ... rest unchanged ...
```

**Existing `GameState` type** (lines 91–136) — add three new fields following the existing optional/nullable field conventions (`pendingFreeMove?: ...`, `lastDiceRoll?: ... | null`):

```typescript
export type GameState = {
  // ... existing fields unchanged ...
  // Phase 8 additions (D-06):
  addedTime: number | null; // null until actionCount first crosses 45
  lastActionType: LastActionType | null; // null at match start and after kick-off reset
  kickOffTeam: 'home' | 'away'; // team that kicked off in the first half
};

// New type — add before GameState:
export type LastActionType =
  | 'MOVEMENT_PHASE'
  | 'SUCCESSFUL_TACKLE'
  | 'STANDARD_PASS'
  | 'FIRST_TIME_PASS'
  | 'HIGH_PASS'
  | 'LONG_BALL'
  | 'HEADER'
  | 'DEFLECTION'
  | 'SNAPSHOT'
  | 'SHOT';
```

---

### `packages/shared/src/events.ts` (config, event-driven — extend existing)

**Analog:** `packages/shared/src/events.ts` (self)

**Existing `ClientEvents` const pattern** (lines 7–18) — add two new entries following the `as const` object pattern:

```typescript
export const ClientEvents = {
  // ... existing ...
  GAME_READY: 'game:ready', // NEW: KICK_OFF_SETUP confirmation (D-24)
  GAME_KICK_OFF_MOVE: 'game:kick-off-move', // NEW: piece repositioning during KICK_OFF_SETUP
  GAME_HALF_TIME_START: 'game:half-time-start', // NEW: trigger 2nd half (D-28)
} as const;
```

**Existing `ClientToServerEvents` interface** (lines 32–46) — add matching typed signatures:

```typescript
export interface ClientToServerEvents {
  // ... existing ...
  [ClientEvents.GAME_READY]: () => void;
  [ClientEvents.GAME_KICK_OFF_MOVE]: (pieceId: string, to: HexCoord) => void;
  [ClientEvents.GAME_HALF_TIME_START]: () => void;
}
```

---

### `packages/shared/src/actionSequence.ts` (utility, transform — NEW FILE)

**Analog:** `packages/shared/src/snapshotValidator.ts`

**File header pattern** (snapshotValidator.ts lines 1–20):

```typescript
/**
 * Action sequence eligibility table for Counter Attack.
 * D-07/D-08: defines which actions are valid after each lastActionType.
 * Importable by both server (enforcement) and client (button disabling).
 */
import type { LastActionType } from './types.js';
```

**Module shape** — a single exported constant (no class, no default export), following the project's functional module style:

```typescript
export type NextActionType =
  | 'MOVEMENT'
  | 'STANDARD_PASS'
  | 'FIRST_TIME_PASS'
  | 'HIGH_PASS'
  | 'LONG_BALL'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'SHOT';

export const ELIGIBLE_NEXT_ACTIONS: Record<LastActionType, ReadonlySet<NextActionType>> = {
  MOVEMENT_PHASE: new Set([
    'MOVEMENT',
    'STANDARD_PASS',
    'HIGH_PASS',
    'LONG_BALL',
    'SNAPSHOT',
    'SHOT',
  ]),
  SUCCESSFUL_TACKLE: new Set(['MOVEMENT', 'STANDARD_PASS', 'HIGH_PASS', 'LONG_BALL', 'SNAPSHOT']),
  STANDARD_PASS: new Set(['MOVEMENT', 'FIRST_TIME_PASS', 'SNAPSHOT']),
  FIRST_TIME_PASS: new Set(['MOVEMENT', 'SNAPSHOT']),
  HIGH_PASS: new Set(['HEADER']),
  LONG_BALL: new Set(['MOVEMENT', 'HEADER']),
  HEADER: new Set(['MOVEMENT', 'FIRST_TIME_PASS', 'SNAPSHOT']),
  DEFLECTION: new Set(['MOVEMENT', 'FIRST_TIME_PASS', 'LONG_BALL', 'SNAPSHOT']),
  SNAPSHOT: new Set([]),
  SHOT: new Set([]),
};
```

**Note:** Use `ReadonlySet` (not `Set`) to match the `ReadonlySet<string>` pattern already established for `PITCH_REGIONS` in `pitch.ts`.

---

### `packages/shared/src/index.ts` (config, transform — extend existing)

**Analog:** `packages/shared/src/index.ts` (self)

**Existing barrel pattern** (lines 1–14) — append one new export line:

```typescript
// Existing lines 3-14 unchanged...
export * from './actionSequence.js'; // NEW: Phase 8 action sequence table
```

---

### `packages/server/src/gameEngine.ts` (service, event-driven — extend existing)

**Analog:** `packages/server/src/gameEngine.ts` (self)

**Existing `buildInitialGameState` pattern** (lines 72–92) — add three new fields to the returned object, following the existing spread pattern:

```typescript
export function buildInitialGameState(roomCode: string): GameState {
  const attackingTeam: 'home' | 'away' = randomInt(0, 2) === 0 ? 'home' : 'away';
  return {
    // ... existing fields ...
    addedTime: null, // D-06: null until actionCount crosses 45
    lastActionType: null, // D-06: null at match start
    kickOffTeam: attackingTeam, // D-06: coin-flip winner kicks off first half
  };
}
```

**Existing `applyEndTurn` result type and function signature** (lines 266–315) — the clock hook is added after `advanceMovementSlot` computes `nextSlot`:

```typescript
// Add addedTimeRoll parameter following applyGKRestart's rollDie pattern (lines 828-832):
export function applyEndTurn(
  state: GameState,
  options?: { addedTimeRoll?: number },
): ApplyEndTurnResult {
  // ...existing guards...
  const { nextSlot, nextPhase } = advanceMovementSlot(state);

  // Phase 8: clock hook at ATTACKER_2 → null transition (D-04)
  if (nextSlot === null) {
    const newActionCount = state.actionCount + 3;
    let newAddedTime = state.addedTime;
    if (newActionCount >= 45 && state.addedTime === null) {
      // Injected die result — never call randomInt inside pure function (D-05, Research Pitfall 1)
      newAddedTime = (options?.addedTimeRoll ?? 3) + state.refereeCard.leniency;
    }
    const halfEnd = 45 + (newAddedTime ?? 0);
    if (newActionCount >= halfEnd) {
      const nextPhaseHalf = state.half === 1 ? 'HALF_TIME' : 'FULL_TIME';
      // ... return HALF_TIME or FULL_TIME state ...
    }
  }
}
```

**New engine function pattern** — copy `applyGKRestart` structure (lines 828–939) for `applySnapshot`, `applyKickOffReady`, `applyHalfTimeStart`, `buildReplayFrames`:

```typescript
// Discriminated union result type — always defined before the function (lines 266-268 pattern):
export type ApplySnapshotResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'NOT_IN_PENALTY_AREA' | 'INVALID_SEQUENCE' }
  | { ok: true; state: GameState };

// Pure function — no randomInt calls; caller injects dice (applyGKRestart pattern lines 828-832):
export function applySnapshot(state: GameState): ApplySnapshotResult {
  // 1. Phase guard
  // 2. Sequence guard via ELIGIBLE_NEXT_ACTIONS
  // 3. Position check via isInRegion(ball.position, 'awayPenaltyArea') / 'homePenaltyArea'
  // Returns state with phase: 'SHOT', lastActionType: 'SNAPSHOT', -1 dice penalty flag
}
```

**`applyRoll` extension pattern** — add `lastActionType` update after each branch resolution, following the existing `lastDiceRoll` embed pattern (lines 459–465):

```typescript
// Existing accurate-pass branch returns:
return { ok: true, state: { ...state, phase: 'SHOT', lastDiceRoll: { ... } } };
// Phase 8: must instead return to action-choice (not SHOT) and set lastActionType:
return { ok: true, state: { ...state, phase: 'PASS', lastActionType: 'STANDARD_PASS', lastDiceRoll: { ... } } };
```

**`buildReplayFrames` — new pure utility function:**

```typescript
// Return type follows discriminated-union-result OR simple array (no failure path — always ok)
export function buildReplayFrames(finalState: GameState): GameState[] {
  // Re-run all non-SLOT_ADVANCE events from buildInitialGameState through eventLog
  // Returns array of GameState snapshots, one per replay-eligible event (D-32)
}
```

---

### `packages/server/src/roomStore.ts` (store, CRUD — extend existing)

**Analog:** `packages/server/src/roomStore.ts` (self)

**Existing `Room` type** (lines 44–57) — add one field, following the `shotTarget?: HexCoord | null` optional-field pattern:

```typescript
export type Room = {
  // ... existing fields (lines 45-57) ...
  shotTarget?: HexCoord | null;
  replayTimer?: ReturnType<typeof setInterval> | null; // NEW: Phase 8 D-31
  readyPlayers?: Set<1 | 2> | null; // NEW: tracks KICK_OFF_SETUP ready state (D-24)
};
```

**Existing `deleteRoom` pattern** (lines 175–183) — add replayTimer cleanup following the `disconnectTimers` loop pattern:

```typescript
export function deleteRoom(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (room) {
    for (const timer of room.disconnectTimers) {
      if (timer !== null) clearTimeout(timer);
    }
    // Phase 8: clear replay timer to prevent post-deletion emit (Research Pitfall 4)
    if (room.replayTimer) clearInterval(room.replayTimer);
  }
  rooms.delete(roomCode);
}
```

---

### `packages/server/src/gameHandlers.ts` (middleware, request-response — extend existing)

**Analog:** `packages/server/src/gameHandlers.ts` (self)

**Existing handler boilerplate** (lines 124–153, `GAME_START_MOVEMENT`) — all new handlers copy this exact 12-line scaffold:

```typescript
socket.on(ClientEvents.GAME_READY, () => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

  room.isProcessing = true;
  try {
    // 1. Phase guard
    if (room.gameState === null || room.gameState.phase !== 'KICK_OFF_SETUP') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    // 2. Validate placement rules (applyKickOffReady)
    const result = applyKickOffReady(room.gameState, socketTeam(socket));
    if (!result.ok) {
      socket.emit(ServerEvents.GAME_ERROR, result.reason);
      broadcastState(io, room);
      return;
    }
    room.gameState = result.state;
    broadcastState(io, room); // ARCH-04
  } finally {
    room.isProcessing = false; // MUST be in finally — Pitfall 5
  }
});
```

**Existing sequence validation pattern** (D-07) — add before every action handler's engine call, following the team-guard pattern (lines 170–173):

```typescript
// Sequence guard (D-07): check lastActionType against ELIGIBLE_NEXT_ACTIONS
if (
  room.gameState.lastActionType !== null &&
  !ELIGIBLE_NEXT_ACTIONS[room.gameState.lastActionType].has('MOVEMENT' /* or action type */)
) {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
  broadcastState(io, room);
  return;
}
```

**Replay setInterval pattern** (D-31) — triggered in the FULL_TIME transition handler:

```typescript
// After transitioning to FULL_TIME (brief display), start replay stream
const frames = buildReplayFrames(room.gameState);
let idx = 0;
room.replayTimer = setInterval(() => {
  if (idx >= frames.length) {
    clearInterval(room.replayTimer!);
    room.replayTimer = null;
    return;
  }
  io.to(room.roomCode).emit(ServerEvents.GAME_STATE, frames[idx++]);
}, 1000);
```

**Existing `rollDice` injection pattern** (lines 288–291, GAME_ROLL) — apply to end-turn handler for added-time roll:

```typescript
// In GAME_END_TURN handler, before calling applyEndTurn:
const addedTimeRoll = rollDice(); // pre-generated; only consumed if actionCount >= 45 && addedTime === null
const result = applyEndTurn(room.gameState, { addedTimeRoll });
```

---

### `packages/client/src/App.tsx` (controller, event-driven — extend existing)

**Analog:** `packages/client/src/App.tsx` (self)

**Existing `onGameState` handler** (lines 21–28) — replace the single `setScreen('GAME_BOARD')` with phase-conditional routing:

```typescript
function onGameState(state: GameState) {
  setGameState(state);
  setDisconnectWarning(false);
  // Phase 8: route to new screens by phase
  if (state.phase === 'HALF_TIME') {
    setScreen('HALF_TIME');
  } else if (state.phase === 'FULL_TIME') {
    setScreen('FULL_TIME');
  } else if (state.phase === 'REPLAY') {
    setScreen('REPLAY');
  } else {
    // Covers KICK_OFF_SETUP — pitch stays visible (GAME_BOARD screen)
    const s = useGameStore.getState().screen;
    if (s !== 'GAME_BOARD') setScreen('GAME_BOARD');
  }
}
```

**Existing render return** (lines 76–78) — extend the ternary to route new screen values:

```typescript
// Existing: screen === 'GAME_BOARD' ? <GameBoard /> : <LobbyScreen />
// Phase 8 extension:
return (
  <div className={styles.app}>
    {screen === 'GAME_BOARD' ? <GameBoard /> :
     screen === 'HALF_TIME' ? <HalfTimeScreen /> :
     screen === 'FULL_TIME' ? <FullTimeScreen /> :
     screen === 'REPLAY'    ? <ReplayScreen /> :
     <LobbyScreen />}
  </div>
);
```

---

### `packages/client/src/store/useGameStore.ts` (store, event-driven — extend existing)

**Analog:** `packages/client/src/store/useGameStore.ts` (self)

**Existing `Screen` type** (line 8) — extend union:

```typescript
export type Screen =
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'WAITING'
  | 'GAME_BOARD'
  | 'HALF_TIME' // NEW
  | 'FULL_TIME' // NEW
  | 'REPLAY'; // NEW
// Note: KICK_OFF_SETUP uses GAME_BOARD (pitch stays visible)
```

**Existing emitter pattern** (lines 118–141) — add new emitters following the `socket.emit(ClientEvents.X)` pattern:

```typescript
emitReady: () => { socket.emit(ClientEvents.GAME_READY); },
emitKickOffMove: (pieceId: string, to: HexCoord) => {
  socket.emit(ClientEvents.GAME_KICK_OFF_MOVE, pieceId, to);
  set({ selectedPieceId: null, validMoveHexes: [] });
},
emitHalfTimeStart: () => { socket.emit(ClientEvents.GAME_HALF_TIME_START); },
```

---

### `packages/client/src/components/KickOffSetupPanel.tsx` + `.module.css` (component, request-response — NEW FILE)

**Analog:** `packages/client/src/components/ActionPanel.tsx`

**File header pattern** (ActionPanel.tsx lines 1–7):

```typescript
import { useGameStore } from '../store/useGameStore.js';
import styles from './KickOffSetupPanel.module.css';
```

**Active-player gate pattern** (ActionPanel.tsx lines 29–33) — `KickOffSetupPanel` is shown to BOTH players (both must confirm ready), so the isActivePlayer gate is NOT applied; instead gate on `phase === 'KICK_OFF_SETUP'`:

```typescript
export function KickOffSetupPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const emitReady = useGameStore((s) => s.emitReady);

  if (phase !== 'KICK_OFF_SETUP') return null;
  // Both slots see the panel — no isActivePlayer check (both reposition pieces)
  // ...
}
```

**CSS pattern** — copy from `ActionPanel.module.css`:

```css
/* Same tokens: surface-card #16213e, border-subtle #0f3460, ctaButton, text-muted */
.panel { background: #16213e; border: 1px solid #0f3460; border-radius: 4px; padding: 16px; ... }
.ctaButton { background: #0f3460; color: #ffffff; border: none; border-radius: 4px; ... }
.ctaButton:disabled { opacity: 0.5; cursor: default; }
```

---

### `packages/client/src/components/HalfTimeScreen.tsx` + `.module.css` (component, request-response — NEW FILE)

**Analog:** `packages/client/src/components/LobbyScreen.tsx`

**Full-screen card layout pattern** (LobbyScreen.tsx lines 145–161):

```typescript
export function HalfTimeScreen() {
  const score = useGameStore((s) => s.gameState.score);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const kickOffTeam = useGameStore((s) => s.gameState.kickOffTeam);
  const emitHalfTimeStart = useGameStore((s) => s.emitHalfTimeStart);

  // Only the team that did NOT kick off first may start the 2nd half (D-28)
  const myTeam: 'home' | 'away' | null =
    playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
  const canStart = myTeam !== null && myTeam !== kickOffTeam;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Score display, "Half Time" heading, conditional Start 2nd Half button */}
      </div>
    </div>
  );
}
```

**CSS pattern** — copy from `LobbyScreen.module.css`:

```css
/* .page: full-screen centred; .card: max-width 440px, surface-card, border-subtle */
/* .heading: 20px/700/text-primary; .body: 13px/400/text-muted */
/* .ctaButton: 0f3460 bg, disabled opacity 0.5 */
```

---

### `packages/client/src/components/FullTimeScreen.tsx` + `.module.css` (component, request-response — NEW FILE)

**Analog:** `packages/client/src/components/LobbyScreen.tsx`

Same `.page` / `.card` layout as `HalfTimeScreen`. Key difference: shows final score, "Play Again" button that calls `setScreen('CREATE_ROOM')` without emitting to server (D-33 — no rematch room reuse):

```typescript
export function FullTimeScreen() {
  const score = useGameStore((s) => s.gameState.score);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* "FULL TIME" heading, final score display */}
        {/* Note: REPLAY starts automatically — no "Watch Replay" button here;
            server transitions to REPLAY phase, onGameState routes to ReplayScreen */}
      </div>
    </div>
  );
}
```

---

### `packages/client/src/components/ReplayPanel.tsx` + `.module.css` (component, event-driven — NEW FILE)

**Analog:** `packages/client/src/components/ActionPanel.tsx` (role-match) + `packages/client/src/components/TurnIndicator.tsx` (data pattern)

**No-interactivity pattern** — no emit calls; display-only (D-33):

```typescript
export function ReplayPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const score = useGameStore((s) => s.gameState.score);
  const setScreen = useGameStore((s) => s.setScreen);
  // eventLog.length gives total events; server sends current replay index implicitly
  // via the reconstructed state (no dedicated replayIndex field in GameState)

  if (phase !== 'REPLAY') return null;

  return (
    <div className={styles.panel}>
      {/* Persistent final score, "Replay" label, "Play Again" button */}
      <button className={styles.ctaButton} onClick={() => setScreen('CREATE_ROOM')}>
        Play Again
      </button>
    </div>
  );
}
```

**CSS pattern** — copy from `ActionPanel.module.css` (`.panel`, `.ctaButton`, `.ctaButton:disabled`).

---

### `packages/server/src/__tests__/gameEngine.phase8.test.ts` (test, CRUD — NEW FILE)

**Analog:** `packages/server/src/__tests__/gameEngine.test.ts`

**File header and import pattern** (gameEngine.test.ts lines 1–11):

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildInitialGameState,
  applyEndTurn,
  applySnapshot,
  applyKickOffReady,
  applyHalfTimeStart,
  buildReplayFrames,
} from '../gameEngine.js';
import { ELIGIBLE_NEXT_ACTIONS } from '@counter-attack/shared';
import type { GameState } from '@counter-attack/shared';
```

**Fixture pattern** (gameEngine.test.ts lines 54–71) — build minimal state objects per test group:

```typescript
const baseHalfwayState: GameState = {
  ...baseMovementState, // spread existing fixture
  actionCount: 44,
  half: 1,
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  movementSlot: 'ATTACKER_2',
};
```

**Test group pattern** (gameEngine.test.ts lines 77–80):

```typescript
describe('applyEndTurn — Phase 8 clock', () => {
  it('increments actionCount by 3 at ATTACKER_2 end (MATCH-01)', () => { ... });
  it('rolls addedTime when actionCount crosses 45 and addedTime is null (MATCH-02)', () => { ... });
  it('does not re-roll addedTime when already set (MATCH-02 guard)', () => { ... });
  it('transitions to HALF_TIME when actionCount >= 45 + addedTime in half 1', () => { ... });
  it('transitions to FULL_TIME when actionCount >= 45 + addedTime in half 2', () => { ... });
});
```

---

## Shared Patterns

### isProcessing Mutex

**Source:** `packages/server/src/gameHandlers.ts` lines 129–153
**Apply to:** All new server handlers (`game:ready`, `game:kick-off-move`, `game:half-time-start`)

```typescript
room.isProcessing = true;
try {
  // handler logic
} finally {
  room.isProcessing = false; // MUST be in finally — never conditionally
}
```

### snap-back on rejection (broadcastState after GAME_ERROR)

**Source:** `packages/server/src/gameHandlers.ts` lines 133–136
**Apply to:** All new handlers — every `socket.emit(ServerEvents.GAME_ERROR, ...)` is followed by `broadcastState(io, room)`

```typescript
socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
broadcastState(io, room); // D-06: snap-back so client reverts optimistic UI
return;
```

### Pure engine function (injected dice)

**Source:** `packages/server/src/gameEngine.ts` lines 828–832
**Apply to:** `applyEndTurn` (addedTimeRoll), `applySnapshot` (no dice needed — pure), `applyKickOffReady` (no dice)

```typescript
// Pattern: caller holds all randomness; engine receives values, never calls randomInt
export function applyGKRestart(
  state: GameState,
  choice: 'kick' | 'throw' | 'movement',
  rollDie: () => number,   // injected
): ApplyGKRestartResult { ... }
```

### Discriminated union result types

**Source:** `packages/server/src/gameEngine.ts` lines 121–124 (`ApplyStartMovementResult`)
**Apply to:** All new engine functions — `ApplySnapshotResult`, `ApplyKickOffReadyResult`, `ApplyHalfTimeStartResult`

```typescript
export type ApplyStartMovementResult =
  | { ok: false; reason: 'WRONG_PHASE' }
  | { ok: true; state: GameState };
```

### Zustand per-slice selector subscriptions

**Source:** `packages/client/src/components/ActionPanel.tsx` lines 14–26
**Apply to:** All new client components — `KickOffSetupPanel`, `HalfTimeScreen`, `FullTimeScreen`, `ReplayPanel`

```typescript
// Each component subscribes only to the slices it needs:
const phase = useGameStore((s) => s.gameState.phase);
const playerSlot = useGameStore((s) => s.playerSlot);
// Never subscribe to the whole store: const store = useGameStore()
```

### CSS Module frozen token usage

**Source:** `packages/client/src/components/LobbyScreen.module.css` + `ActionPanel.module.css`
**Apply to:** All four new CSS modules

```css
/* Surface hierarchy: #1a1a2e (page) → #16213e (card/panel) → #0f3460 (button/border) */
/* Text: #e0e0e0 primary, #a0a0a0 muted */
/* CTA button: background #0f3460, hover #1a56b0, disabled opacity 0.5 */
/* No new colour values — all tokens are frozen from Phase 6/7 */
```

### socket.off cleanup in useEffect

**Source:** `packages/client/src/App.tsx` lines 67–73
**Apply to:** Any new `useEffect` socket listener in new screen components

```typescript
return () => {
  socket.off(ServerEvents.GAME_STATE, onGameState);
  // ... all listeners registered in this effect
};
```

### `isInRegion` for zone boundary checks

**Source:** `packages/shared/src/pitch.ts` lines 60–72 (`PITCH_REGIONS` definition)
**Apply to:** `applyKickOffReady` (centre circle check, half boundary check), `applySnapshot` (penalty area check)

```typescript
import { isInRegion, PITCH_REGIONS } from '@counter-attack/shared';
// Centre hex check:
const isOnCentreHex = hex.q === PITCH_REGIONS.kickOffHex.q && hex.r === PITCH_REGIONS.kickOffHex.r;
// Zone check:
const inCentreCircle = isInRegion(hex, 'centreCircle');
const inAwayPenalty = isInRegion(hex, 'awayPenaltyArea');
```

---

## No Analog Found

All files have close analogs in the codebase. No entries in this section.

---

## Metadata

**Analog search scope:** `packages/server/src/`, `packages/client/src/`, `packages/shared/src/`
**Files scanned:** 14 source files read in full or in targeted sections
**Pattern extraction date:** 2026-06-04
