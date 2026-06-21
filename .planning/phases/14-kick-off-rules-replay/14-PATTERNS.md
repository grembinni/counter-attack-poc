# Phase 14: Kick Off Rules & Replay - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 5
**Analogs found:** 5 / 5

## File Classification

| New/Modified File                                                | Role               | Data Flow                     | Closest Analog                                             | Match Quality           |
| ---------------------------------------------------------------- | ------------------ | ----------------------------- | ---------------------------------------------------------- | ----------------------- |
| `packages/server/src/gameHandlers.ts`                            | handler/controller | event-driven (Socket.io)      | self — GAME_KICK_OFF_MOVE handler                          | exact (modify in-place) |
| `packages/server/src/gameEngine.ts`                              | engine/service     | transform (eventLog → frames) | self — buildReplayFrames                                   | exact (modify in-place) |
| `packages/shared/src/types.ts`                                   | shared types       | —                             | self — ActionEvent union                                   | exact (extend members)  |
| `packages/server/src/__tests__/kickoffSetup.integration.test.ts` | integration test   | request-response              | `packages/server/src/__tests__/replay.integration.test.ts` | role-match              |
| `packages/server/src/__tests__/replay.integration.test.ts`       | integration test   | event-driven                  | self — existing test                                       | exact (extend in-place) |

---

## Pattern Assignments

### D-03: `startReplayStream` delay (gameHandlers.ts line 188)

**Change:** One-line. Change `1000` → `500` on the `setInterval` call.

**Current code** (`packages/server/src/gameHandlers.ts` lines 173–188):

```typescript
liveRoom.replayTimer = setInterval(() => {
  if (idx >= frames.length) {
    clearInterval(liveRoom.replayTimer!);
    liveRoom.replayTimer = null;
    return;
  }
  const frame = frames[idx++]!;
  const replayFrame: import('@counter-attack/shared').GameState = {
    ...frame,
    replayIndex: idx,
    replayTotal,
  };
  io.to(liveRoom.roomCode).emit(ServerEvents.GAME_STATE, replayFrame);
}, 1000); // <-- change to 500
```

---

### D-02: GAME_ROLL KICK_OFF guard (gameHandlers.ts ~line 976)

**Where to insert:** Inside the existing `if (room.gameState.phase === 'PASS' || room.gameState.phase === 'KICK_OFF')` block, immediately after the `passType` validation block (after the `INVALID_SEQUENCE` check, around line 996), before the `targetHex` check.

**Guard pattern to copy from existing rejections** (lines 964–996):

```typescript
// Phase guard pattern (copy this structure):
socket.emit(ServerEvents.GAME_ERROR, 'KICKOFF_STANDARD_PASS_ONLY');
broadcastState(io, room);
return;
```

**Full insertion point context** (lines 976–996):

```typescript
if (room.gameState.phase === 'PASS' || room.gameState.phase === 'KICK_OFF') {
  const PASS_TYPES = ['STANDARD_PASS', 'FIRST_TIME_PASS', 'HIGH_PASS', 'LONG_BALL'] as const;
  if (!passType || !(PASS_TYPES as readonly string[]).includes(passType)) {
    socket.emit(ServerEvents.GAME_ERROR, 'MISSING_PASS_TYPE');
    broadcastState(io, room);
    return;
  }
  const effectiveLastAction = room.gameState.lastActionType ?? 'MOVEMENT_PHASE';
  if (!ELIGIBLE_NEXT_ACTIONS[effectiveLastAction].has(passType)) {
    socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
    broadcastState(io, room);
    return;
  }
  // *** INSERT D-02 GUARD HERE ***
  // if (room.gameState.phase === 'KICK_OFF' && passType !== 'STANDARD_PASS') {
  //   socket.emit(ServerEvents.GAME_ERROR, 'KICKOFF_STANDARD_PASS_ONLY');
  //   broadcastState(io, room);
  //   return;
  // }
```

**Rejection pattern — all three lines always go together** (no variant exists in codebase):

```typescript
socket.emit(ServerEvents.GAME_ERROR, '<ERROR_CODE>');
broadcastState(io, room);
return;
```

---

### D-04/D-05: `buildReplayFrames` restructure (gameEngine.ts lines 2854–2899)

**Existing flat loop to restructure** (`packages/server/src/gameEngine.ts` lines 2854–2899):

```typescript
for (const event of finalState.eventLog) {
  // SLOT_ADVANCE events produce no board change — skip (D-32)
  if (event.type === 'SLOT_ADVANCE') {
    continue;
  }

  // Apply board mutations for replay-eligible events
  if (event.type === 'MOVE') {
    const moveEvent = event;
    const newPieces = current.pieces.map((p) =>
      p.id === moveEvent.pieceId ? { ...p, position: moveEvent.to } : p,
    );
    current = { ...current, pieces: newPieces };
  } else if (event.type === 'GOAL') {
    const goalEvent = event;
    const newScore = {
      ...current.score,
      [goalEvent.scoringTeam]: current.score[goalEvent.scoringTeam] + 1,
    };
    current = {
      ...current,
      score: newScore,
      ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
    };
  } else if (event.type === 'KICK_OFF') {
    current = { ...current, movementSlot: 'ATTACKER_4' };
  }

  if (REPLAY_ELIGIBLE_TYPES.has(event.type)) {
    frames.push({
      ...current,
      phase: 'REPLAY',
      score: { ...current.score },
    });
  }
}
```

**Restructure strategy (D-04/D-05):** Replace the flat loop with a two-pass accumulator:

1. Accumulate consecutive `MOVE` events (skip `SLOT_ADVANCE`) into a `moveGroup: Map<pieceId, HexCoord[]>` (paths per piece).
2. When a non-MOVE, non-SLOT_ADVANCE event is encountered — or at end of log — flush the accumulated group as K frames (K = max path length across all pieces in the group). Frame n shows each piece at step n, or at its last position if it finished earlier.
3. After flushing the move group, emit one frame for the boundary non-MOVE event as before.

**Frame emit pattern (copy for each synthesized step-frame):**

```typescript
frames.push({
  ...current,
  phase: 'REPLAY',
  score: { ...current.score },
});
```

---

### D-06: `ballAfter` field on ActionEvent union (types.ts lines 80–214)

**Existing member shape to extend** — every replay-eligible member currently ends with `timestamp: number`. The new required field goes on each member:

```typescript
ballAfter: {
  position: HexCoord;
  carrierId: string | null;
}
```

**Members that need `ballAfter`** (confirmed against `REPLAY_ELIGIBLE_TYPES` set in gameEngine.ts lines 2786–2800):

- `MOVE` (line 81)
- `DICE_ROLL` (line 90)
- `STEAL_ATTEMPT` (line 91)
- `GOAL` (line 110)
- `KICK_OFF` (line 111)
- `HIGH_PASS` (line 113)
- `LONG_BALL` (line 121)
- `STANDARD_PASS` (line 122)
- `FIRST_TIME_PASS` (line 131)
- `SHOT_ATTEMPT` (line 140)
- `SNAPSHOT` (line 172)
- `HALF_TIME` (line 173)
- `FULL_TIME` (line 174)

**Members NOT in REPLAY_ELIGIBLE_TYPES — do NOT add `ballAfter`:**
`SLOT_ADVANCE`, `TACKLE_ATTEMPT`, `DEFLECT_ATTEMPT`, `HEADER`, `HP_REPOSITION`, `HP_ACCURACY`, `HP_MOVE`, `LOOSE_BALL_LAND`, `GK_KICK`, `GK_KICK_MOVE`

**Event-creation pattern in gameEngine.ts** (lines ~1067–1074, representative):

```typescript
const highPassEvent: ActionEvent = {
  type: 'HIGH_PASS',
  passerId: kickerId ?? '',
  from: kickerPiece?.position ?? targetHex,
  to: targetHex,
  accurate: null,
  timestamp: Date.now(),
  // ADD: ballAfter: { position: state.ball.position, carrierId: state.ball.carrierId }
};
```

**Migration guide:** After updating the type, TypeScript compile errors enumerate every event-creation site in gameEngine.ts that is missing `ballAfter`. Fix each site by reading `state.ball` at the point of event construction.

**In `buildReplayFrames`:** After D-06, replace the existing GOAL-only ball update with a universal handler:

```typescript
// After applying board mutations, update ball from event.ballAfter
if ('ballAfter' in event && event.ballAfter) {
  current = { ...current, ball: event.ballAfter };
}
```

---

### Integration Tests — kickoffSetup.integration.test.ts

**Test scaffold pattern** (lines 1–55 of kickoffSetup file, lines 1–55 of replay file — identical structure):

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
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
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
  clearAllRooms();
});
```

**`oncePromise` helper** (replay.integration.test.ts lines 78–93) — copy verbatim for kickoffSetup new tests:

```typescript
function oncePromise<E extends keyof ServerToClientEvents>(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  event: E,
  timeoutMs = 2000,
): Promise<Parameters<ServerToClientEvents[E]>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event "${String(event)}" after ${timeoutMs}ms`));
    }, timeoutMs);
    (socket as any).once(event, (...args: unknown[]) => {
      clearTimeout(timer);
      resolve(args as Parameters<ServerToClientEvents[E]>);
    });
  });
}
```

**Fake timer pattern for replay tests** (replay.integration.test.ts):

- `vi.useFakeTimers()` inside the `it` body before actions that trigger timers
- `vi.advanceTimersByTimeAsync(N)` to advance setInterval/setTimeout
- `vi.useRealTimers()` in `afterEach` (already present)

**GAME_ERROR assertion pattern** (from kickoffSetup test — extend for MATCH-07):

```typescript
const [errorCode] = await oncePromise(socket, ServerEvents.GAME_ERROR);
expect(errorCode).toBe('KICKOFF_STANDARD_PASS_ONLY');
// followed by snap-back state assertion:
const [snapState] = await oncePromise(socket, ServerEvents.GAME_STATE);
expect(snapState.phase).toBe('KICK_OFF');
```

**State seeding pattern for replay tests** (replay.integration.test.ts lines 140–158):

```typescript
const room = getRoom(roomCode)!;
room.gameState = {
  ...room.gameState!,
  phase: 'FULL_TIME',
  eventLog: [
    ...room.gameState!.eventLog,
    {
      type: 'MOVE',
      pieceId: room.gameState!.pieces[0]!.id,
      from: room.gameState!.pieces[0]!.position,
      to: {
        q: room.gameState!.pieces[0]!.position.q + 1,
        r: room.gameState!.pieces[0]!.position.r,
      },
      slot: 'ATTACKER_4' as const,
      timestamp: Date.now(),
    },
  ],
};
```

---

## Shared Patterns

### Rejection (snap-back) pattern

**Source:** `packages/server/src/gameHandlers.ts` — every guard block throughout the file
**Apply to:** D-02 new guard in GAME_ROLL handler

```typescript
socket.emit(ServerEvents.GAME_ERROR, '<ERROR_CODE>');
broadcastState(io, room);
return;
```

### isProcessing mutex wrap

**Source:** `packages/server/src/gameHandlers.ts` lines 961–962 (and all other handlers)
**Apply to:** No new handlers in Phase 14 — D-02 guard is inserted inside an existing `isProcessing` try block; no change to the wrapping.

```typescript
room.isProcessing = true;
try {
  // ... guards and logic ...
} finally {
  room.isProcessing = false;
}
```

### Frame emit (REPLAY phase tag)

**Source:** `packages/server/src/gameEngine.ts` lines 2892–2898
**Apply to:** Every synthesized step-frame in the restructured `buildReplayFrames`

```typescript
frames.push({
  ...current,
  phase: 'REPLAY',
  score: { ...current.score },
});
```

---

## No Analog Found

None — all files are in-place modifications of existing files with well-established patterns.

---

## Metadata

**Analog search scope:** `packages/server/src/`, `packages/shared/src/`
**Files read:** gameHandlers.ts (lines 155–224, 940–1080, 1340–1400), gameEngine.ts (lines 2782–2902), types.ts (lines 36–214), kickoffSetup.integration.test.ts (lines 1–80), replay.integration.test.ts (lines 1–180)
**Pattern extraction date:** 2026-06-12
