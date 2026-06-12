# Phase 11: Rule Correctness - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 7
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File                                | Role       | Data Flow        | Closest Analog                                                                                         | Match Quality |
| ------------------------------------------------ | ---------- | ---------------- | ------------------------------------------------------------------------------------------------------ | ------------- |
| `packages/shared/src/types.ts`                   | model      | —                | self (add fields to existing `GameState`)                                                              | exact         |
| `packages/shared/src/events.ts`                  | config     | event-driven     | self (add one `ClientEvents` entry)                                                                    | exact         |
| `packages/server/src/gameEngine.ts`              | service    | event-driven     | self (add `headerAccuracyRollPending` to HIGH_PASS branch; clear `lastShotPath` in LOOSE_BALL scatter) | exact         |
| `packages/server/src/gameHandlers.ts`            | controller | event-driven     | self (GAME_HEADER_CONTESTANT auto-duel; GAME_HEADER_TARGET winner guard; add GAME_HEADER_ACCURACY_ACK) | exact         |
| `packages/client/src/components/HexGrid.tsx`     | component  | request-response | self (`canSelectSnapDeflect` pace guard; RULE-05 `canSelect` diagnosis)                                | exact         |
| `packages/client/src/store/useGameStore.ts`      | store      | event-driven     | self (`selectPiece` SNAP_DEFLECT branch already has pace guard — no change needed here per RESEARCH)   | exact         |
| `packages/client/src/components/ActionPanel.tsx` | component  | request-response | self (HEADER phase block; add accuracy-roll acknowledgment gate before contestant UI)                  | exact         |

---

## Pattern Assignments

### `packages/shared/src/types.ts` (model — add two GameState fields)

**Analog:** same file, existing optional fields pattern.

**Naming convention for optional phase-scoped fields** (types.ts lines 349–404):

```typescript
// Pattern: optional field, typed nullable, JSDoc with phase number and RULE ID
headerContestants?: { home: string[]; away: string[] } | null;   // line 349
headerConfirmed?: { home: boolean; away: boolean } | null;        // line 355
headerTargetHex?: HexCoord | null;                                // line 392
snapDeflectPaceUsed?: number;                                     // line 404
lastShotPath?: HexCoord[] | null;                                 // line 406
```

**New fields to add** — follow same pattern, insert after `headerTargetHex` (line 392):

```typescript
/**
 * RULE-01 (Phase 11): true when high-pass accuracy roll has resolved but the
 * attacker has not yet acknowledged the result. Contestant selection UI is
 * suppressed until this flag clears. null or absent outside HEADER phase.
 */
headerAccuracyRollPending?: boolean | null;

/**
 * RULE-02 (Phase 11): winner of the heading duel.
 * Set in GAME_HEADER_CONTESTANT when both teams confirm and duel auto-fires.
 * Used by GAME_HEADER_TARGET to validate the submitting team.
 * null or absent outside HEADER phase after duel resolves.
 */
headerDuelWinner?: 'home' | 'away' | null;
```

**`headerCleared` spread** (gameEngine.ts lines 1374–1378) — BOTH new fields must be added here to prevent persistence across phases:

```typescript
// Current (gameEngine.ts ~line 1374):
const headerCleared = {
  headerContestants: null,
  headerConfirmed: null,
  headerTargetHex: null,
};

// After RULE-01 + RULE-02 (add two entries):
const headerCleared = {
  headerContestants: null,
  headerConfirmed: null,
  headerTargetHex: null,
  headerAccuracyRollPending: null, // RULE-01
  headerDuelWinner: null, // RULE-02
};
```

---

### `packages/shared/src/events.ts` (config — add GAME_HEADER_ACCURACY_ACK event)

**Analog:** existing `ClientEvents` constant object (events.ts lines 7–44) and `ClientToServerEvents` interface (lines 58–103).

**Pattern for adding a new event** (events.ts lines 28–43 show the two-step pattern):

```typescript
// Step 1: add to ClientEvents const object (events.ts ~line 43 area)
GAME_HEADER_ACCURACY_ACK: 'game:header-accuracy-ack',

// Step 2: add to ClientToServerEvents interface (events.ts ~line 103 area)
[ClientEvents.GAME_HEADER_ACCURACY_ACK]: () => void;
```

No payload needed — the event is a zero-argument acknowledgment. Follow the pattern of `GAME_RESTART_MOVEMENT` and `GAME_HALF_TIME_START` (both are `() => void`).

---

### `packages/server/src/gameEngine.ts` (service — RULE-01 flag, RULE-02 duel refactor, RULE-03 clear)

**Analog:** same file. Three distinct change sites.

#### RULE-01: Add `headerAccuracyRollPending: true` to HIGH_PASS → HEADER transition

**Pattern reference:** `kickOffActive: true` assignment in kick-off setup (gameEngine.ts line 122). Boolean flag set on phase entry, cleared by a separate event.

The HIGH_PASS → HEADER transition return object (~line 1068–1084) currently returns:

```typescript
return {
  ok: true,
  state: {
    ...state,
    phase: 'HEADER',
    ball: { position: targetHex, carrierId: null },
    lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
    lastActionType: newLastActionType,
    actionCount: state.actionCount + passTimeCost,
    passTargetHex: null,
    preGeneratedInterceptionDice: [],
    eventLog: newEventLog,
    headerContestants: { home: [] as string[], away: [] as string[] },
    headerConfirmed: { home: !homeEligible, away: !awayEligible },
    headerTargetHex: null,
    // ADD: headerAccuracyRollPending: true,  // RULE-01
  },
};
```

#### RULE-02: `applyRoll` HEADER branch must read `headerDuelWinner` instead of re-rolling

**Open Question 1 from RESEARCH.md** — recommended approach: `GAME_HEADER_TARGET` stops calling `applyRoll` and instead calls a new `applyResolveHeaderTarget(state, targetHex)` engine function. This function reads `state.headerDuelWinner` (already set by the handler) and transitions to PASS/GK_DIVING without re-rolling dice.

**Analog for a pure engine function that reads pre-resolved state:**

```typescript
// Existing pattern: applyDeclareHeaderTarget (gameEngine.ts) reads state fields and
// returns { ok: true, state: {...} } or { ok: false, reason: string }.
// The new applyResolveHeaderTarget follows the same signature.
export function applyResolveHeaderTarget(
  state: GameState,
  targetHex: HexCoord,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  // 1. Phase guard
  if (state.phase !== 'HEADER') return { ok: false, reason: 'WRONG_PHASE' };
  // 2. Winner must be known
  if (!state.headerDuelWinner) return { ok: false, reason: 'DUEL_NOT_RESOLVED' };
  // 3. Validate targetHex within header range of winner's contestant position
  // 4. Transition to PASS / GK_DIVING based on pre-resolved winner (no dice re-roll)
  // 5. Spread ...headerCleared
}
```

#### RULE-03: Clear `lastShotPath` in LOOSE_BALL scatter → PASS return

**The bug** (gameEngine.ts ~lines 1736–1748): the LOOSE_BALL scatter return spreads `...state`, inheriting a non-null `lastShotPath` from the prior SHOT phase.

**Fix** — add `lastShotPath: null` to the LOOSE_BALL return object:

```typescript
// gameEngine.ts ~line 1736 (applyRoll LOOSE_BALL branch return):
return {
  ok: true,
  state: {
    ...state,
    phase: 'PASS',
    ball: { position: finalPosition, carrierId: finalCarrierId },
    attackingTeam: newAttackingTeam,
    activeTeam: newAttackingTeam,
    lastDiceRoll: { rolls: [d1, d2], context: 'LOOSE_BALL' },
    lastActionType: 'DEFLECTION',
    lastShotPath: null, // RULE-03: clear stale shot path from prior SHOT phase
    eventLog: [...state.eventLog, looseBallLandEvent],
  },
};
```

**Confirmed correct branches** (no change needed):

- gameEngine.ts ~1179: SHOT GOAL — `lastShotPath: null` already present
- gameEngine.ts ~1255: SHOT GOAL (duel win) — `lastShotPath: null` already present
- gameEngine.ts ~1328: SHOT SAVE (caught) → GK_RESTART — `lastShotPath: null` already present
- gameHandlers.ts ~763: SNAP_DEFLECT deflected → LOOSE_BALL — `lastShotPath: null` already present
- gameHandlers.ts ~816: SNAP_DEFLECT auto-GOAL — `lastShotPath: null` already present

**Confirmed bug branches** (RULE-03 fixes required):

- gameEngine.ts ~1291: SHOT LOOSE_BALL (tie) — `lastShotPath: shotPath` — add `lastShotPath: null`
- gameEngine.ts ~1343: SHOT SAVE (dropped) → LOOSE_BALL — `lastShotPath: shotPath` — add `lastShotPath: null`
- gameEngine.ts ~1736: LOOSE_BALL scatter → PASS — inherited from spread — add `lastShotPath: null`

---

### `packages/server/src/gameHandlers.ts` (controller — RULE-01 ack handler, RULE-02 auto-duel + winner guard)

**Analog:** existing handler patterns (lines 1862–1924 for GAME_HEADER_CONTESTANT; lines 1779–1860 for GAME_HEADER_TARGET).

#### Handler skeleton pattern (isProcessing + try/finally + broadcastState)

All handlers follow this exact structure — copy verbatim for the new GAME_HEADER_ACCURACY_ACK handler:

```typescript
// Source: gameHandlers.ts ~line 1873 (GAME_HEADER_CONTESTANT pattern)
socket.on(ClientEvents.GAME_HEADER_ACCURACY_ACK, () => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

  room.isProcessing = true;
  try {
    // Phase guard
    if (room.gameState === null || room.gameState.phase !== 'HEADER') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room); // snap-back
      return;
    }
    // Team guard: only attacking team can acknowledge
    if (!controlsAttackingTeam(socket, room)) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
      broadcastState(io, room);
      return;
    }
    // Clear the flag
    room.gameState = { ...room.gameState, headerAccuracyRollPending: null };
    broadcastState(io, room); // ARCH-04
  } finally {
    room.isProcessing = false; // MUST be in finally — Pitfall 5
  }
});
```

#### RULE-02: Auto-fire duel in GAME_HEADER_CONTESTANT when both teams confirmed

**Insertion point:** after line 1916 (`headerConfirmed: { ...existingConfirmed, [teamSlot]: true }`), before the existing `broadcastState` on line 1920.

**Duel-trigger pattern** (copy from GAME_HEADER_TARGET auto-roll at lines 1843–1856):

```typescript
// Source: gameHandlers.ts ~line 1843 (auto-roll pattern)
const atkTeam = room.gameState.attackingTeam;
const defTeam = atkTeam === 'home' ? 'away' : 'home';
const atkCount = room.gameState.headerContestants?.[atkTeam]?.length ?? 0;
const defCount = room.gameState.headerContestants?.[defTeam]?.length ?? 0;
const numDice = Math.max(atkCount + defCount, 2);
const diceArr = Array.from({ length: numDice }, () => rollDice());
// NOTE: for RULE-02, call a duel-only engine function that sets headerDuelWinner
// but does NOT transition phase (winner still needs to select target hex).
// Do NOT call applyRoll here — that would transition past HEADER prematurely.
```

**Both-confirmed check pattern** (GAME_READY handler uses same double-confirmed pattern):

```typescript
const bothConfirmed =
  room.gameState.headerConfirmed?.home === true && room.gameState.headerConfirmed?.away === true;
if (bothConfirmed) {
  // fire duel, set headerDuelWinner
}
```

#### RULE-02: Replace attacker guard with winner guard in GAME_HEADER_TARGET

**Current guard** (gameHandlers.ts line 1827–1831):

```typescript
// Current (line 1827):
if (!controlsAttackingTeam(socket, room)) {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
  broadcastState(io, room);
  return;
}
```

**Replacement** (follow `socketTeam` pattern from lines 83–110):

```typescript
// After RULE-02:
const duelWinner = room.gameState.headerDuelWinner;
if (!duelWinner || socketTeam(socket) !== duelWinner) {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
  broadcastState(io, room);
  return;
}
```

**`socketTeam` helper** is already defined at gameHandlers.ts line 83:

```typescript
function socketTeam(socket: AppSocket): 'home' | 'away' {
  return socket.data.playerSlot === 1 ? 'home' : 'away';
}
```

---

### `packages/client/src/components/HexGrid.tsx` (component — RULE-04 pace guard, RULE-05 diagnosis)

**Analog:** same file.

#### RULE-04: Add `snapDeflectPaceUsed` subscription and pace guard to `canSelectSnapDeflect`

**Step 1 — check subscription block** (HexGrid.tsx lines 47–94). `snapDeflectPaceUsed` is NOT currently subscribed (line 92 subscribes `snapDeflectMovedPieceId` but not `snapDeflectPaceUsed`). Add:

```typescript
// Add after line 92 (snapDeflectMovedPieceId subscription):
const snapDeflectPaceUsed = useGameStore((s) => s.gameState.snapDeflectPaceUsed);
```

**Pattern reference:** identical pattern to `highPassPaceUsed` subscription (line 81):

```typescript
const highPassPaceUsed = useGameStore((s) => s.gameState.highPassPaceUsed);
```

**Step 2 — add guard to `canSelectSnapDeflect`** (HexGrid.tsx lines 570–575):

```typescript
// Current (lines 570-575):
const canSelectSnapDeflect =
  phase === 'SNAP_DEFLECT' &&
  myTeam !== null &&
  myTeam === snapDefendingTeam &&
  piece.teamId === myTeam &&
  (snapDeflectMovedPieceId === null || snapDeflectMovedPieceId === piece.id);

// After RULE-04 (add pace guard as final condition):
const canSelectSnapDeflect =
  phase === 'SNAP_DEFLECT' &&
  myTeam !== null &&
  myTeam === snapDefendingTeam &&
  piece.teamId === myTeam &&
  (snapDeflectMovedPieceId === null || snapDeflectMovedPieceId === piece.id) &&
  (snapDeflectPaceUsed ?? 0) < 2; // RULE-04: suppress when pace exhausted
```

**Pattern reference for `?? 0` null-guard:** same pattern used in `selectPiece` store at useGameStore.ts line 408: `const paceRemaining = 2 - (gameState.snapDeflectPaceUsed ?? 0);`

#### RULE-05: `canSelect` diagnosis instrumentation

**Suspect conditions in `canSelect`** (HexGrid.tsx lines 553–558):

```typescript
// Source: HexGrid.tsx lines 546-558
const slotQuota = movementSlot === 'ATTACKER_4' ? 4 : movementSlot === 'DEFENDER_5' ? 5 : 2;
const activatedCount = Object.keys(paceUsedByPieceId).length;
const pieceAlreadyActivated = (paceUsedByPieceId[piece.id] ?? 0) > 0;
const slotFull = activatedCount >= slotQuota && !pieceAlreadyActivated;

const canSelect =
  isActivePlayer && // myTeam === activeTeam
  phase === 'MOVEMENT' &&
  piece.teamId === activeTeam &&
  !movedPieceIds.includes(piece.id) &&
  !slotFull;
```

**Diagnosis instrumentation pattern** — add a one-time console.log inside the piece render loop immediately after the `canSelect` block, guarded by `phase === 'MOVEMENT'`:

```typescript
// Temporary RULE-05 diagnosis (remove after root cause confirmed):
if (phase === 'MOVEMENT' && process.env.NODE_ENV !== 'production') {
  if (piece.id === pieces[0]?.id) {
    // log once per render, not per piece
    console.log('[RULE-05 DIAGNOSIS]', {
      movementSlot,
      activeTeam,
      attackingTeam,
      isActivePlayer,
      paceUsedByPieceIdKeys: Object.keys(paceUsedByPieceId),
      movedPieceIds,
      slotQuota,
      activatedCount,
    });
  }
}
```

**Key subscriptions already in place** (HexGrid.tsx lines 52–56):

```typescript
const activeTeam = useGameStore((s) => s.gameState.activeTeam); // line 52
const attackingTeam = useGameStore((s) => s.gameState.attackingTeam); // line 53
const movedPieceIds = useGameStore((s) => s.gameState.movedPieceIds); // line 54
const movementSlot = useGameStore((s) => s.gameState.movementSlot); // line 55
const paceUsedByPieceId = useGameStore((s) => s.gameState.paceUsedByPieceId); // line 56
```

---

### `packages/client/src/components/ActionPanel.tsx` (component — RULE-01 accuracy-roll gate)

**Analog:** same file, existing HEADER phase block (lines 181–226).

**Pattern reference — boolean flag gate before contestant UI** (lines 181–226):

```typescript
// Current: ActionPanel.tsx lines 181-226
if (phase === 'HEADER') {
  if (myTeam === null) return null;
  const myConfirmed = headerConfirmed?.[myTeam] ?? false;
  const bothConfirmed = (headerConfirmed?.home ?? false) && (headerConfirmed?.away ?? false);

  if (bothConfirmed) { /* ... target hex prompt ... */ }

  return (/* contestant selection UI */);
}
```

**RULE-01 addition:** insert an early return block at the TOP of the HEADER phase block (before the `bothConfirmed` check), gated on `headerAccuracyRollPending`:

```typescript
if (phase === 'HEADER') {
  if (myTeam === null) return null;

  // RULE-01: show accuracy roll result and await attacker acknowledgment
  const accuracyPending = gameState.headerAccuracyRollPending ?? false;
  if (accuracyPending) {
    const rollValue = gameState.lastDiceRoll?.rolls[0] ?? '?';
    if (isActivePlayer && myTeam === attackingTeam) {
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>
            High Pass accuracy roll: {rollValue} — pass is accurate! Click to continue.
          </span>
          <button className={styles.ctaButton} onClick={() => emitHeaderAccuracyAck()}>
            Continue
          </button>
          {gameError && <span className={styles.errorText}>{gameError}</span>}
        </div>
      );
    }
    return (
      <div className={styles.panel}>
        <span className={styles.phaseLabel}>
          High Pass accuracy roll: {rollValue} — waiting for attacker...
        </span>
      </div>
    );
  }

  // ... existing bothConfirmed / contestant UI ...
}
```

**New store action** — `emitHeaderAccuracyAck` follows the same pattern as `emitHeaderContestant` in useGameStore.ts (~line 280):

```typescript
// Source: useGameStore.ts ~line 280 (emit pattern)
socket.emit(ClientEvents.GAME_HEADER_CONTESTANT, pieceIds);

// New action (same pattern):
emitHeaderAccuracyAck: () => {
  const { socket } = get();
  if (!socket) return;
  socket.emit(ClientEvents.GAME_HEADER_ACCURACY_ACK);
},
```

**`gameState` subscription in ActionPanel** (ActionPanel.tsx line 40 area — verify `headerAccuracyRollPending` is accessible via `gameState` slice):

```typescript
// ActionPanel already subscribes:
const headerConfirmed = useGameStore((s) => s.gameState.headerConfirmed); // line 40
// Add:
const gameState = useGameStore((s) => s.gameState); // if not already subscribed, add for headerAccuracyRollPending
```

---

## Shared Patterns

### isProcessing Mutex + try/finally

**Source:** `packages/server/src/gameHandlers.ts` lines 1877–1923 (GAME_HEADER_CONTESTANT handler)
**Apply to:** New GAME_HEADER_ACCURACY_ACK handler; all new branches in GAME_HEADER_CONTESTANT

```typescript
room.isProcessing = true;
try {
  // ... handler logic with early returns ...
} finally {
  room.isProcessing = false; // MUST be in finally — Pitfall 5
}
```

### broadcastState After Every State Mutation

**Source:** `packages/server/src/gameHandlers.ts` line 1920
**Apply to:** Every new `room.gameState = { ... }` assignment in any handler

```typescript
room.gameState = { ...room.gameState /* new fields */ };
broadcastState(io, room); // ARCH-04: single broadcast per handler path
```

### Snap-back on Error

**Source:** `packages/server/src/gameHandlers.ts` lines 1883–1885
**Apply to:** All early-return error paths in new handlers

```typescript
socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
broadcastState(io, room); // snap-back to ensure client state is consistent
return;
```

### Optional Field Null Guard (`?? false` / `?? null`)

**Source:** `packages/client/src/components/ActionPanel.tsx` line 183; `packages/client/src/store/useGameStore.ts` line 408
**Apply to:** All client reads of new `headerAccuracyRollPending` and `headerDuelWinner` fields

```typescript
const accuracyPending = gameState.headerAccuracyRollPending ?? false;
const paceRemaining = 2 - (gameState.snapDeflectPaceUsed ?? 0);
```

### headerCleared Spread (prevent header fields persisting across phases)

**Source:** `packages/server/src/gameEngine.ts` lines 1374–1378
**Apply to:** RULE-01 and RULE-02 new fields must be added to this spread

```typescript
const headerCleared = {
  headerContestants: null,
  headerConfirmed: null,
  headerTargetHex: null,
  headerAccuracyRollPending: null, // RULE-01 — ADD THIS
  headerDuelWinner: null, // RULE-02 — ADD THIS
};
```

---

## No Analog Found

None — all files are modifications to existing files with clear in-file patterns to follow.

---

## Metadata

**Analog search scope:** `packages/server/src/`, `packages/client/src/`, `packages/shared/src/`
**Files scanned:** 7 source files read directly
**Pattern extraction date:** 2026-06-11
