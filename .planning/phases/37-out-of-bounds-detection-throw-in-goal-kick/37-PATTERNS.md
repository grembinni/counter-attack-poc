# Phase 37: Out-of-Bounds Detection, Throw-In & Goal Kick - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 13 (new + modified)
**Analogs found:** 13 / 13

## File Classification

| New/Modified File                                                                       | Role                        | Data Flow          | Closest Analog                                                                                                                                                                                          | Match Quality |
| --------------------------------------------------------------------------------------- | --------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `packages/shared/src/outOfBounds.ts` (new)                                              | utility (pure function)     | transform          | `packages/shared/src/scoreUtils.ts` (`computeCombinedScore`/`computeLooseBall`)                                                                                                                         | role-match    |
| `packages/shared/src/outOfBounds.test.ts` (new)                                         | test                        | transform          | `packages/shared/src/*.test.ts` (pure-function unit tests, e.g. `scoreUtils.test.ts`/`offside.test.ts`)                                                                                                 | role-match    |
| `packages/shared/src/types.ts` (modify)                                                 | model                       | CRUD (state shape) | existing `GameState`/`BallState`/`GamePhase`/`LastActionType` definitions in same file                                                                                                                  | exact         |
| `packages/shared/src/actionSequence.ts` (modify)                                        | config/data table           | request-response   | `ELIGIBLE_NEXT_ACTIONS` (same file)                                                                                                                                                                     | exact         |
| `packages/server/src/gameEngine.ts` (modify: LOOSE_BALL hook, new apply\* fns)          | service (pure FSM function) | event-driven       | `applyGKRestart`/`applyGKKickTarget`/`applyQuickThrow` (`gameEngine.ts:2880-3097`); `applyFreeKickMove`/`applyFreeKickReady` (`gameEngine.ts:4133-4441`); `LOOSE_BALL` case (`gameEngine.ts:2769-2833`) | exact         |
| `packages/server/src/gameHandlers.ts` (modify: new socket handlers)                     | controller (socket handler) | request-response   | `GAME_FREE_KICK_MOVE`/`GAME_FREE_KICK_READY` handlers (`gameHandlers.ts:1886-1994`)                                                                                                                     | exact         |
| `packages/server/src/roomStore.ts` (modify: `outOfBoundsEnabled` toggle)                | model/config                | CRUD               | `Room.gameSpeed?`/`Room.teamType?` settings toggles                                                                                                                                                     | exact         |
| `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` (new)                    | test                        | event-driven       | `packages/server/src/__tests__/gameEngine.test.ts`                                                                                                                                                      | role-match    |
| `packages/server/src/__tests__/throwIn.integration.test.ts` (new)                       | test                        | event-driven       | `packages/server/src/__tests__/kickoffSetup.integration.test.ts`                                                                                                                                        | exact         |
| `packages/server/src/__tests__/goalKick.integration.test.ts` (new)                      | test                        | event-driven       | `packages/server/src/__tests__/kickoffSetup.integration.test.ts`                                                                                                                                        | exact         |
| `packages/client/src/components/ThrowInSetupPanel.tsx` (new)                            | component                   | request-response   | `packages/client/src/components/FreeKickSetupPanel.tsx`                                                                                                                                                 | exact         |
| `packages/client/src/components/GoalKickSetupPanel.tsx` (new)                           | component                   | request-response   | `packages/client/src/components/FreeKickSetupPanel.tsx` (staged reposition shape)                                                                                                                       | exact         |
| `packages/client/src/components/GameBoard.tsx` (modify: PHASE_LABEL + dispatch ternary) | component (dispatcher)      | request-response   | existing `PHASE_LABEL` (`GameBoard.tsx:24-59`) + phase-dispatch ternary (`GameBoard.tsx:300-360`)                                                                                                       | exact         |
| `packages/client/src/components/GameSettingsScreen.tsx` (modify: new checkbox row)      | component                   | request-response   | `toggleDraftPool`/checkbox-row pattern (`GameSettingsScreen.tsx:40-154`)                                                                                                                                | exact         |

## Pattern Assignments

### `packages/shared/src/outOfBounds.ts` (utility, transform)

**Analog:** `packages/shared/src/scoreUtils.ts` (`computeCombinedScore`, `computeLooseBall`)

**Pattern:** pure, side-effect-free function, no I/O, importable by both server and shared consumers. Follow the exact shape RESEARCH.md already specifies (verbatim, do not deviate from the recommended signature since it is the pre-agreed contract for Phase 38's Corner Kick extension):

```typescript
export type OutOfBoundsExit = 'SIDELINE' | 'BYLINE' | null;

export function classifyExit(hex: HexCoord): OutOfBoundsExit {
  const qOut = hex.q < 0 || hex.q > 36;
  const rOut = hex.r < 0 || hex.r > 25;
  if (!qOut && !rOut) return null; // still on pitch
  if (qOut) return 'BYLINE'; // D-05: ambiguous double-boundary defaults to BYLINE
  return 'SIDELINE';
}

export function classifyOutOfBounds(
  exit: 'SIDELINE' | 'BYLINE',
  lastTouchedByTeam: 'home' | 'away' | null,
): 'THROW_IN' | 'GOAL_KICK' | 'CORNER_KICK' {
  if (exit === 'SIDELINE') return 'THROW_IN';
  // Phase 37 scope: only GOAL_KICK reachable (OOB-04); CORNER_KICK is Phase 38.
  return 'GOAL_KICK';
}
```

Import `HexCoord` from `./hex.js` (module-relative `.js` extension convention used project-wide, confirmed in `scoreUtils.ts` imports).

---

### `packages/shared/src/types.ts` (model, CRUD)

**Analog:** existing `BallState` (`types.ts:45-48`), `GamePhase` union (`types.ts:403-430`), `freeMoveEligibleIds`/`freeMoveUsedPace` fields (`types.ts:936-949`)

**`BallState.lastTouchedBy` — required field, non-optional (D-06):**

```typescript
export type BallState = {
  position: HexCoord;
  carrierId: string | null;
  lastTouchedBy: { pieceId: string; teamId: 'home' | 'away' } | null;
};
```

Making this required (not `?`) forces every `ball: { position, carrierId }` object-literal construction site across `gameEngine.ts` to be updated — a compile error surfaces every missed site.

**Per-piece pace-budget field shape (Goal Kick's 6-hex reposition window, GOALKICK-02) — copy `freeMoveEligibleIds`/`freeMoveUsedPace`'s shape:**

```typescript
// existing precedent (types.ts:942, 949):
freeMoveEligibleIds?: { attack: readonly string[]; defense: readonly string[] } | null;
freeMoveUsedPace?: Readonly<Record<string, number>> | null;

// new goal-kick fields, same shape, per-team-window instead of attack/defense:
goalKickWindow?: 'GK_TEAM' | 'OPPONENT' | null;
goalKickEligibleIds?: { gkTeam: readonly string[]; opponent: readonly string[] } | null;
goalKickUsedPace?: Readonly<Record<string, number>> | null;
```

**Throw-in fields (simple scalars, no budget table needed — single piece):**

```typescript
throwInHex?: HexCoord | null;
throwInTeam?: 'home' | 'away' | null;
throwInPhasesTaken?: 0 | 1 | 2 | null;
```

**New `LastActionType` rows (mirrors existing `'MOVEMENT_PHASE'`/`'DEFLECTION'` rows):**

```typescript
| 'THROW_IN_MOVEMENT_1'
| 'THROW_IN_MOVEMENT_2'
```

**New `GamePhase` values** must be added to the `GamePhase` union AND immediately propagated to `PHASE_LABEL` (compiler-enforced) and `GameBoard.tsx`'s dispatch ternary (NOT compiler-enforced — Pitfall 1). Candidate names, following the `GK_KICK_TARGET`/`GK_KICK_MOVE` naming convention (D-03):
`THROW_IN_SETUP`, `GOAL_KICK_SETUP_GK`, `GOAL_KICK_SETUP_OPPONENT`, `GOAL_KICK_CHOICE`, `GOAL_KICK_TARGET`, `GOAL_KICK_MOVE`.

---

### `packages/shared/src/actionSequence.ts` (config/data table, request-response)

**Analog:** `ELIGIBLE_NEXT_ACTIONS` (`actionSequence.ts:49-59`, `'MOVEMENT_PHASE'` row)

**Pattern:** add two new `Record<LastActionType, ReadonlySet<NextActionType>>` rows — TypeScript's exhaustiveness check on the `Record` forces every `LastActionType` key present, so this is a compile-enforced checklist item:

```typescript
THROW_IN_MOVEMENT_1: new Set<NextActionType>(['STANDARD_PASS', 'HIGH_PASS', 'MOVEMENT']),
THROW_IN_MOVEMENT_2: new Set<NextActionType>(['STANDARD_PASS', 'HIGH_PASS']), // D-09 hard cap, no MOVEMENT
```

---

### `packages/server/src/gameEngine.ts` (service, event-driven)

**Analog 1 — the `LOOSE_BALL` clamp hook site** (`gameEngine.ts:2769-2833`):

```typescript
case 'LOOSE_BALL': {
  const direction = d1 as 1 | 2 | 3 | 4 | 5 | 6;
  const distance = d2 as 1 | 2 | 3 | 4 | 5 | 6;
  const from = state.ball.position;
  let clampedPos = from;
  for (let step = 1; step <= distance; step++) {
    const next: HexCoord = computeLooseBall(from, direction, step as 1 | 2 | 3 | 4 | 5 | 6);
    if (isPitchHex(next)) clampedPos = next;
    else break; // <-- REPLACE this break: classify + branch, gated on state.outOfBoundsEnabled
  }
  // ...trajectory walk to clampedPos, occupant-carrier detection, then:
  return { ok: true, state: { ...state, phase: 'PASS', ball: {...}, /* ... */ } };
}
```

Copy the `if (!state.outOfBoundsEnabled) { /* byte-for-byte unchanged existing loop */ } else { /* classify next via classifyExit, branch to THROW_IN_SETUP / GOAL_KICK_SETUP */ }` early-branch shape exactly as RESEARCH.md's Code Examples section specifies — do not interleave conditionals inside the loop body (OOB-05 requires the disabled path be provably unchanged).

**Analog 2 — staged restart chain shape to mirror for the new Goal Kick phases** (`applyGKRestart`/`applyGKKickTarget`/`applyQuickThrow`, `gameEngine.ts:2880-3097`):

Structural template (phase-guard → validate input → look up ball carrier/GK → branch → return new phase + cleared dice/lastActionType):

```typescript
export function applyGKKickTarget(state: GameState, targetHex: HexCoord): ApplyGKKickTargetResult {
  if (state.phase !== 'GK_KICK_TARGET') return { ok: false, reason: 'WRONG_PHASE' };
  const gk = state.pieces.find((p) => p.id === state.ball.carrierId);
  if (!gk) return { ok: false, reason: 'WRONG_PHASE' };
  if (!isPitchHex(targetHex)) return { ok: false, reason: 'OFF_PITCH' };
  if (targetHex.q === gk.position.q && targetHex.r === gk.position.r) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }
  const restrictedRegion = gk.teamId === 'home' ? 'awayThird' : ('homeThird' as const);
  if (isInRegion(targetHex, restrictedRegion)) return { ok: false, reason: 'INVALID_TARGET' };
  // ...construct event, return { ok: true, state: { ...state, phase: 'GK_KICK_MOVE', ... } }
}
```

Use this exact discriminated-union result shape (`ApplyXResult = {ok:false; reason: ...} | {ok:true; state: GameState}`) for every new `applyThrowInPlace`/`applyGoalKickReposition`/`applyGoalKickChoice`/`applyGoalKickTarget`/`applyGoalKickMove` function. Per D-01, do NOT call these existing GK-restart functions from the new goal-kick phases — only copy their _shape_.

**Analog 3 — `applyEndTurn`'s non-generic-branch precedent** (`gameEngine.ts:1106-1132`), the template for the throw-in movement-count branch inserted before the generic `PASS` return at `gameEngine.ts:1141`:

```typescript
if (carrier?.role === 'GK') {
  const ownArea = carrier.teamId === 'home' ? 'homePenaltyArea' : 'awayPenaltyArea';
  if (isInRegion(carrier.position, ownArea)) {
    return { ok: true, state: { ...state, phase: 'GK_RESTART' /* ... */ } };
  }
}
// NEW equivalent branch for throw-in movement-phase counting:
if (state.throwInPhasesTaken !== null && state.throwInPhasesTaken !== undefined) {
  const nextLastActionType =
    state.throwInPhasesTaken === 0 ? 'THROW_IN_MOVEMENT_1' : 'THROW_IN_MOVEMENT_2';
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      lastActionType: nextLastActionType,
      throwInPhasesTaken: (state.throwInPhasesTaken + 1) as 1 | 2,
    },
  };
}
```

**Analog 4 — GK_KICK_MOVE slot-alternation pattern** to copy for `GOAL_KICK_MOVE` (both teams move 1 piece ≤3 hexes while ball travels): reference `gkKickMovementSlot`/`gkKickMovedPieceId`/`gkKickPaceUsed` fields and their alternation logic at `gameEngine.ts:1432-1546` — mirror the identical shape into new `goalKickMoveSlot`/`goalKickMovedPieceId`/`goalKickPaceUsed` fields.

**Error handling pattern:** every `apply*` function returns `{ ok: false, reason: '<UPPER_SNAKE_REASON>' }` rather than throwing; reasons are short enum-like strings (`'WRONG_PHASE'`, `'OFF_PITCH'`, `'INVALID_TARGET'`, `'RANGE_EXCEEDED'`) consumed directly by `socket.emit(ServerEvents.GAME_ERROR, result.reason)` in the handler layer — do not introduce a different error shape.

---

### `packages/server/src/gameHandlers.ts` (controller, request-response)

**Analog:** `GAME_FREE_KICK_MOVE` handler (`gameHandlers.ts:1886-1955`)

```typescript
socket.on(ClientEvents.GAME_THROW_IN_PLACE, (pieceId: string) => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

  room.isProcessing = true;
  try {
    if (room.gameState === null || room.gameState.phase !== 'THROW_IN_SETUP') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    // payload shape validation (typeof checks) before use — V5 input validation
    // team-ownership check: socketTeam(socket) !== piece.teamId -> NOT_YOUR_PIECE
    // isPitchHex/occupancy guard before delegating to pure apply* function
    const result = applyThrowInPlace(room.gameState, pieceId);
    if (!result.ok) {
      socket.emit(ServerEvents.GAME_ERROR, result.reason);
      broadcastState(io, room);
      return;
    }
    room.gameState = result.state;
    broadcastState(io, room);
  } finally {
    room.isProcessing = false; // MUST be in finally — project-wide SC-5/Pitfall 5 convention
  }
});
```

Every new handler (throw-in placement/throw, goal-kick reposition/choice/target/move) must follow this exact mutex → phase-guard → payload-shape-validation → ownership-check → delegate-to-pure-function → broadcast shape. Also extend `validUndoPhases: GamePhase[]` in the `GAME_UNDO` handler (`gameHandlers.ts:1130-1139`) with the new phases if Undo is supported for them (recommended per RESEARCH.md Don't-Hand-Roll table).

---

### `packages/server/src/roomStore.ts` (model/config, CRUD)

**Analog:** existing `Room.gameSpeed?`/`Room.teamType?` toggle fields (grep-confirmed in RESEARCH.md Sources)

Add `outOfBoundsEnabled?: boolean` to `Room` following the identical settings-toggle precedent — client collects the toggle pre-match on `GameSettingsScreen`, server bakes it into `GameState` via `buildInitialGameState`'s parameter list (note: this is an already-long 8-parameter positional function per RESEARCH.md Pitfall 5 — audit all call sites when adding the new parameter, do not rely on TypeScript to catch a missing optional-with-default argument).

---

### `packages/client/src/components/ThrowInSetupPanel.tsx` / `GoalKickSetupPanel.tsx` (component, request-response)

**Analog:** `packages/client/src/components/FreeKickSetupPanel.tsx` (full file read, 227 lines)

Key structural pieces to copy:

- Early-return-`null` guard block when phase doesn't match / required state fields are null/undefined (lines 48-59) — narrows `myTeamOrNull` to `'home'|'away'` before use.
- Inactive-team waiting-panel branch (lines 73-82) — `"{Team} is repositioning…"` phrasing, per D-07/Phase 35 convention:

```tsx
if (!isMyStage) {
  return (
    <div className={styles.panel}>
      <span className={styles.panelHeading}>{/* two-line title+detail per Phase 35 */}</span>
      <span className={styles.constraintRow}>
        {isKicking ? 'Attacking' : 'Defending'} team is repositioning&hellip;
      </span>
    </div>
  );
}
```

- Constraint computation + `disabledTitle` pattern (lines 84-110) — compute booleans from `hexDistance`/`movedPieceIds`, build a human-readable `disabledTitle` string for the disabled-button tooltip.
- `withEndTurnConfirm` wrapper + `confirmDialog` JSX (lines 123-157) — "N players left, are you sure?" confirm-overlay pattern, reusable verbatim if goal-kick's 6-hex window needs the same guard.
- Undo eligibility via boundary-event scan (lines 160-168) — `eventLog` scan for a boundary `ActionEvent` type, then checks whether any post-boundary event exists.
- `ctaColorClass` usage (line 174-178) for the Confirm button's ready/pending color state.
- Final render: `panelHeading` span, constraint rows, error text (`gameError`), Undo button (disabled via `canUndo`), Confirm button (`disabled={!constraintsMet}`, verb **"Confirm"** per D-07 Phase 35 lock) (lines 180-225).

No container border (Phase 35 D-01 lock) — confirm the CSS module (`FreeKickSetupPanel.module.css`) has no border rule on `.panel` and mirror that in the new `.module.css` files.

---

### `packages/client/src/components/GameBoard.tsx` (component dispatcher, request-response)

**Analog:** `PHASE_LABEL` (`GameBoard.tsx:24-59`, compiler-enforced `Record<GamePhase, string>`) + phase-dispatch ternary (`GameBoard.tsx:300-360`, NOT compiler-enforced)

Add every new `GamePhase` value to both. The dispatch ternary is the Pitfall-1 risk site — a missed entry silently falls back to the generic `ActionPanel` instead of rendering `ThrowInSetupPanel`/`GoalKickSetupPanel`. Also check `BALL_MARKER_PHASES` (`BallLocationRing.tsx`, per `docs/HIGHLIGHT-REFERENCE.md` §3) — add target/move phases where the ball is mid-air or fixed at a hex, matching the existing restart-phase list's precedent.

---

### `packages/client/src/components/GameSettingsScreen.tsx` (component, request-response)

**Analog:** `toggleDraftPool`/checkbox-row pattern (`GameSettingsScreen.tsx:40-154`)

Add a new "Out-of-Bounds / Restarts" checkbox row following the identical existing toggle-row markup/state-handler shape used for `draftPool`/other pre-match settings toggles.

---

### Test files

**Analog for `outOfBounds.test.ts`:** any existing `packages/shared/src/*.test.ts` pure-function unit test (e.g. `scoreUtils.test.ts`, `offside.test.ts`) — direct input/output assertions on `classifyExit`/`classifyOutOfBounds`, no mocking, no fixtures needed since these are pure functions of `HexCoord`.

**Analog for `throwIn.integration.test.ts` / `goalKick.integration.test.ts`:** `packages/server/src/__tests__/kickoffSetup.integration.test.ts` — mirror its structure exactly: spin up two connected socket.io-client sockets against an in-process server, join a room, drive the game to the target phase, emit the new client events in sequence, assert on broadcast `GameState` after each step.

**Analog for `gameEngine.outOfBounds.test.ts`:** extend `packages/server/src/__tests__/gameEngine.test.ts`'s existing `LOOSE_BALL` clamp test cases with `outOfBoundsEnabled: false` cases (assert byte-for-byte unchanged clamp behavior) and `outOfBoundsEnabled: true` cases (assert classification + phase transition).

## Shared Patterns

### `isProcessing` mutex + phase-guard + pure-function-delegate (every socket handler)

**Source:** `packages/server/src/gameHandlers.ts:1886-1955` (`GAME_FREE_KICK_MOVE`)
**Apply to:** every new throw-in/goal-kick socket handler.

```typescript
room.isProcessing = true;
try {
  if (room.gameState === null || room.gameState.phase !== '<EXPECTED_PHASE>') {
    socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
    broadcastState(io, room);
    return;
  }
  // validate payload shape, ownership, then delegate to a pure apply* function
  const result = applyX(room.gameState, ...args);
  if (!result.ok) {
    socket.emit(ServerEvents.GAME_ERROR, result.reason);
    broadcastState(io, room);
    return;
  }
  room.gameState = result.state;
  broadcastState(io, room);
} finally {
  room.isProcessing = false; // MUST be in finally
}
```

### Discriminated-union `ApplyXResult` return shape

**Source:** `packages/server/src/gameEngine.ts` (`ApplyGKKickTargetResult`, `ApplyQuickThrowResult`, etc.)
**Apply to:** every new `apply*` pure FSM function.

```typescript
export type ApplyXResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'INVALID_TARGET' | 'OFF_PITCH' | '<...>' }
  | { ok: true; state: GameState };
```

### Server-authoritative target-hex validation (defense-in-depth)

**Source:** `applyGKKickTarget` (`gameEngine.ts:2986` `isPitchHex` guard), `applyQuickThrow` (`gameEngine.ts:3060`)
**Apply to:** throw-in throw target and goal-kick target-selection handlers — explicit `isPitchHex(targetHex)` guard even though `validatePass` itself has no such check (Pitfall 4 in RESEARCH.md — do not modify `validatePass`, add the guard only in the new handlers).

### Phase-registration checklist (Pitfall 1)

**Source:** `types.ts` `GamePhase` union, `GameBoard.tsx` `PHASE_LABEL` + dispatch ternary, `gameHandlers.ts` `validUndoPhases`, `BallLocationRing.tsx` `BALL_MARKER_PHASES`
**Apply to:** every new `GamePhase` value introduced by this phase — register in all four lists; the dispatch ternary and marker list are NOT compiler-enforced and are the most common miss.

### Settings-toggle plumbing (`gameSpeed`/`teamType` precedent)

**Source:** `packages/server/src/roomStore.ts` `Room.gameSpeed?`/`Room.teamType?`
**Apply to:** `outOfBoundsEnabled` — client checkbox (`GameSettingsScreen.tsx`) → `Room` field → `buildInitialGameState` positional parameter → `GameState.outOfBoundsEnabled` → sole enforcement point at the `LOOSE_BALL` classification hook.

## No Analog Found

None — every file in this phase's scope has a strong existing analog in the codebase (this is pure internal FSM-extension work per RESEARCH.md; no new external integration).

## Metadata

**Analog search scope:** `packages/shared/src`, `packages/server/src`, `packages/server/src/__tests__`, `packages/client/src/components`
**Files read:** `gameEngine.ts` (LOOSE_BALL region, GK-restart chain region), `gameHandlers.ts` (GAME_FREE_KICK_MOVE region), `FreeKickSetupPanel.tsx` (full), `actionSequence.ts` (header + first rows), `types.ts` (grep for `freeMoveEligibleIds`/`freeMoveUsedPace`)
**Pattern extraction date:** 2026-08-03
