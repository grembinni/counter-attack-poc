---
phase: 08-match-lifecycle-post-game-replay
reviewed: 2026-06-05
status: issues_found
depth: standard
files_reviewed: 4
findings:
  critical: 1
  warning: 4
  info: 1
  total: 6
---

# Phase 08 Code Review — Gap Closure Pass

**Files reviewed (gap-closure 08-07 / 08-08):**

- `packages/server/src/gameHandlers.ts`
- `packages/server/src/gameEngine.ts`
- `packages/client/src/components/ActionPanel.tsx`
- `packages/client/src/store/useGameStore.ts`

**Gap-closure status:** All 4 original verification gaps confirmed closed (CR-01 GAME_SNAPSHOT handler ✓, CR-01 Snapshot button guard ✓, CR-02 GAME_HEADER handler ✓, CR-03 GK spill LOOSE_BALL ✓, CR-04 setGameState selection clear ✓). New defects found in adjacent code.

---

## Findings

### CR-01 — `startReplayStream` setTimeout creates an uncleanable interval after room deletion

**File:** `packages/server/src/gameHandlers.ts` ~line 143–161
**Severity:** BLOCKER

`startReplayStream` captures `room` by JavaScript object reference in a `setTimeout` closure (3-second hold before replay begins). The comment claims "If the room is deleted during the 3s hold, the interval will never start." This is incorrect.

`deleteRoom(roomCode)` removes the room from the Map but does not nullify the captured reference. If the room is deleted during the 3-second hold, `deleteRoom` calls `clearInterval(room.replayTimer)` at deletion time when `room.replayTimer` is still `null` (the `setInterval` hasn't been created yet). The `setTimeout` callback then fires 3 seconds later on the orphaned object, sets `room.replayTimer = setInterval(...)`, and begins emitting indefinitely. This `setInterval` is never cleaned up — `deleteRoom` has already finished and will not run again for this object.

**Fix:** Re-fetch the room from the store inside the `setTimeout` callback:

```typescript
setTimeout(() => {
  const liveRoom = getRoom(room.roomCode);
  if (!liveRoom || liveRoom.gameState === null) return;
  // use liveRoom instead of room for all subsequent references
}, 3000);
```

---

### WR-01 — `passTypes` set contains dead `'HIGH_PASS'` entry in `applySnapshot`

**File:** `packages/server/src/gameEngine.ts` ~line 1143–1152
**Severity:** WARNING

The `passTypes` set used to gate snapshot eligibility in PASS phase includes `'HIGH_PASS'`. An accurate HIGH_PASS transitions to `phase: 'HEADER'`, never remaining in `phase: 'PASS'`. Additionally `ELIGIBLE_NEXT_ACTIONS['HIGH_PASS']` does not contain `'SNAPSHOT'`, so the sequence guard (which runs first) would reject it before the phase check. The entry is dead code.

**Fix:** Remove `'HIGH_PASS'` from the set and add a comment.

---

### WR-02 — Intermediate slot transitions in `applyEndTurn` do not reset `lastActionType`

**File:** `packages/server/src/gameEngine.ts` ~line 395–408
**Severity:** WARNING

Non-ATTACKER_2 slot transitions (e.g., ATTACKER_4→DEFENDER_5) return `...state` without clearing `lastActionType`. A `lastActionType` set during the previous slot carries forward into the new slot, causing incorrect sequence validation. The ATTACKER_2→null transition correctly sets `lastActionType: 'MOVEMENT_PHASE'`; intermediate transitions should do the same.

---

### WR-03 — `passTrigger` Snapshot condition too permissive in `ActionPanel.tsx`

**File:** `packages/client/src/components/ActionPanel.tsx` ~line 60–61
**Severity:** WARNING

```typescript
const passTrigger = phase === 'PASS' && lastActionType !== null;
```

Shows the Snapshot button whenever phase is PASS and any action has been taken, regardless of whether `lastActionType` is actually eligible for SNAPSHOT. The existing `isEligible()` helper already models the sequence table correctly.

**Fix:**

```typescript
const passTrigger = phase === 'PASS' && isEligible('SNAPSHOT');
```

---

### WR-04 — `GAME_HEADER` and `GAME_ROLL` both handle HEADER phase; `ActionPanel` shows duplicate resolution buttons

**File:** `packages/server/src/gameHandlers.ts` ~line 740–784
**Severity:** WARNING

`GAME_ROLL` already covers `phase === 'HEADER'` via `DICE_PHASES`. The new `GAME_HEADER` handler also calls `applyRoll` for HEADER. In HEADER phase, `ActionPanel` shows both "Roll Dice" and "Header" buttons — two identical actions with different labels. The mutex prevents a double-process race, but the duplicate UX is confusing.

**Fix:** Exclude HEADER from the "Roll Dice" button visibility in `ActionPanel`, or remove the dedicated "Header" button and `GAME_HEADER` event entirely.

---

### IN-01 — `passTypes` Set allocated inside `applySnapshot` on every call

**File:** `packages/server/src/gameEngine.ts` ~line 1143
**Severity:** INFO

Minor: the `passTypes` Set is recreated on each invocation. Should be hoisted to a module-level constant.

---

## Summary Table

| ID    | File                              | Severity | Description                                                                     |
| ----- | --------------------------------- | -------- | ------------------------------------------------------------------------------- |
| CR-01 | gameHandlers.ts                   | BLOCKER  | `startReplayStream` timer leak after room deletion during 3s hold               |
| WR-01 | gameEngine.ts                     | WARNING  | Dead `'HIGH_PASS'` in `passTypes` set inside `applySnapshot`                    |
| WR-02 | gameEngine.ts                     | WARNING  | Intermediate slot transitions don't reset `lastActionType`                      |
| WR-03 | ActionPanel.tsx                   | WARNING  | `passTrigger` should use `isEligible('SNAPSHOT')` not `lastActionType !== null` |
| WR-04 | gameHandlers.ts + ActionPanel.tsx | WARNING  | Duplicate HEADER resolution buttons in ActionPanel                              |
| IN-01 | gameEngine.ts                     | INFO     | `passTypes` Set should be module-level constant                                 |
