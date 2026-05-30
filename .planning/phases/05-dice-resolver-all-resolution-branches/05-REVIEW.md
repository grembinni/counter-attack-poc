---
phase: 05-dice-resolver-all-resolution-branches
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - packages/server/src/__tests__/diceUtils.test.ts
  - packages/server/src/__tests__/game.integration.test.ts
  - packages/server/src/__tests__/gameEngine.test.ts
  - packages/server/src/diceUtils.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/shared/src/events.ts
  - packages/shared/src/passValidator.test.ts
  - packages/shared/src/passValidator.ts
  - packages/shared/src/shotValidator.test.ts
  - packages/shared/src/shotValidator.ts
  - packages/shared/src/teams.test.ts
  - packages/shared/src/teams.ts
  - packages/shared/src/types.ts
findings:
  critical: 4
  warning: 6
  info: 3
  total: 13
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Fourteen files were reviewed covering the Phase 05 dice resolver implementation: the engine's `applyRoll`/`applyGKRestart` functions, the game handler wire-up, the pass/shot/heading validators, the team definitions, shared types, and their test suites.

The implementation is architecturally coherent — discriminated-union results, injected dice, immutable state spreads, and the `finally`-based mutex are all done correctly. The critical bugs found are primarily logic errors in edge-case resolution paths that produce incorrect game outcomes; they do not crash the server but they silently give wrong results.

---

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Inaccurate pass branches reuse direction/distance dice from the wrong pool

**File:** `packages/server/src/gameEngine.ts:457-471`
**Issue:** In the `PASS` branch of `applyRoll`, when the pass is inaccurate the Loose Ball landing is computed using `d1` (the accuracy die) as the direction die, and `d2` as the distance die:

```typescript
const landing = computeLooseBall(
  state.ball.position,
  d1 as 1 | 2 | 3 | 4 | 5 | 6, // <-- d1 was the accuracy roll, not a direction roll
  d2 as 1 | 2 | 3 | 4 | 5 | 6,
);
```

`d1` is the accuracy roll; its value is already constrained to whichever low number caused the inaccuracy (e.g. dice=1 always means accuracy failed, so the Loose Ball will almost always go East). A fresh pair of dice should be used for direction and distance. The same structural bug exists in the `SHOT → SAVE → spill` path (line 563-568) which also reuses `d1`/`d2` rather than dedicated post-save direction/distance dice.

**Fix:** Pre-generate five dice upfront in the handler for phases that may cascade (pass accuracy → loose ball, save → spill), or use the existing `d2`/`d3` slots for the direction/distance dice only when the primary resolution path is known not to need them. The cleanest fix is to give `applyRoll` a richer dice object, or to make the PASS branch consume `d1`=accuracy, `d2`=direction, `d3`=distance:

```typescript
// In PASS branch — inaccurate path:
const landing = computeLooseBall(
  state.ball.position,
  d2 as 1 | 2 | 3 | 4 | 5 | 6, // direction
  d3 as 1 | 2 | 3 | 4 | 5 | 6, // distance
);
// and update lastDiceRoll to reflect all three: { rolls: [d1, d2, d3], context: 'PASS_ACCURACY' }
```

The handler already pre-generates three dice (d1, d2, d3); the fix is purely in the engine.

---

### CR-02: SHOT tie produces `MOVEMENT` phase but test comment and doc say `LOOSE_BALL`

**File:** `packages/server/src/gameEngine.ts:516-531`  
**File:** `packages/server/src/__tests__/gameEngine.test.ts:553-563`

**Issue:** The `SHOT → LOOSE_BALL` outcome transitions to phase `'MOVEMENT'` (line 527), not `'LOOSE_BALL'`. The `LOOSE_BALL` game phase exists specifically to allow the Loose Ball roll to occur; transitioning directly to `MOVEMENT` skips that roll entirely and the ball lands in its current (pre-loose) position — which is the shooter's position. The test at line 560-562 even asserts `phase === 'MOVEMENT'` and `ball.carrierId === null`, which confirms the wrong phase transition is silently accepted by the tests:

```typescript
// gameEngine.test.ts line 553 — comment says "LOOSE_BALL (D-13)" but asserts 'MOVEMENT':
it('SHOT tie (shooterScore === gkScore) → LOOSE_BALL (D-13), ball.carrierId null', () => {
  ...
  expect(result.state.phase).toBe('MOVEMENT');   // <-- should be 'LOOSE_BALL'
```

The same pattern appears for the SAVE+spill case (line 571-577). In both cases the Loose Ball position is computed (`computeLooseBall` is called) but then the phase is set to `'MOVEMENT'` directly, bypassing the `LOOSE_BALL` phase and any associated game rules (e.g. the attacker-change rule if applicable). D-13 requires transitioning through `LOOSE_BALL` so the client can render the Loose Ball state before play resumes.

**Fix:** In the SHOT branch, when the outcome is `LOOSE_BALL` or `SAVE`+spill, transition to phase `'LOOSE_BALL'` (which then waits for a `game:roll` from the active player to compute the final landing), or if the design intent is to immediately resolve Loose Ball without a second roll, that must be documented and the phase must remain consistent. Based on the existing `LOOSE_BALL` phase handler in `applyRoll` and the `DICE_PHASES` set in `gameHandlers.ts` (line 52), the intent is clearly a two-step roll:

```typescript
// Shot tie → transition to LOOSE_BALL; a second game:roll resolves the landing
return {
  ok: true,
  state: {
    ...state,
    phase: 'LOOSE_BALL',
    ball: { position: state.ball.position, carrierId: null },
    lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
  },
};
```

---

### CR-03: `applyUndo` does not restore `movedPieceIds` when undoing a move

**File:** `packages/server/src/gameEngine.ts:364-400`
**Issue:** `applyUndo` correctly restores the piece position, decrements `paceUsedByPieceId`, and removes the MOVE event from the log. However, it never removes the `pieceId` from `state.movedPieceIds`. This means that after a player undoes a move in `ATTACKER_2`, the piece still appears in `movedPieceIds`, and a subsequent re-move will be rejected with `ALREADY_MOVED_IN_ATTACKER4` by `validateMove` (line 72 of `moveValidator.ts`). The piece is effectively stuck — undo appears to work but re-moving is impossible.

```typescript
// applyUndo returns — no movedPieceIds update:
return {
  ok: true,
  state: {
    ...state,
    pieces: newPieces,
    paceUsedByPieceId: newPaceUsed,
    eventLog: newEventLog,
    pendingFreeMove: undoPendingFreeMove,
    // movedPieceIds is MISSING from this spread — stays as-is
  },
};
```

The test at `gameEngine.test.ts:313-327` verifies the position is restored and pace is reset but does not assert that `movedPieceIds` is emptied, so the bug is untested.

**Fix:**

```typescript
const newMovedPieceIds = state.movedPieceIds.filter((id) => id !== moveToUndo.pieceId);

return {
  ok: true,
  state: {
    ...state,
    pieces: newPieces,
    paceUsedByPieceId: newPaceUsed,
    eventLog: newEventLog,
    pendingFreeMove: undoPendingFreeMove,
    movedPieceIds: newMovedPieceIds,
  },
};
```

---

### CR-04: HEADER contested-tie Loose Ball reuses `d1`/`d2` (attacker/defender dice) as direction/distance

**File:** `packages/server/src/gameEngine.ts:730-745`
**Issue:** The same reuse problem as CR-01 but in the HEADER branch. When the attacker and defender tie in a contested heading duel, the code computes:

```typescript
const landing = computeLooseBall(
  state.ball.position,
  d1 as 1 | 2 | 3 | 4 | 5 | 6, // d1 was attackerDice — biased by the heading contest
  d2 as 1 | 2 | 3 | 4 | 5 | 6, // d2 was defenderDice — also biased
);
```

`d1` and `d2` were already used to compute `attackerScore` and `defenderScore`. Their values are constrained by the fact that they produced a tie — the dice values that can produce a tie are limited to specific pairs (e.g. both rolled the same number, both rolled numbers that coincidentally offset). The Loose Ball direction/distance should come from independent dice rolls, not recycled heading dice.

**Fix:** Consume a fresh pair of dice for direction/distance. Since the handler currently only pre-generates three dice, either add a fourth and fifth die to the `applyRoll` signature for the HEADER tie case, or document that `d3` is the heading GK die and the header tie uses a subsequent `LOOSE_BALL` phase (same fix as CR-02):

```typescript
// Tie → transition to LOOSE_BALL phase for a fresh direction+distance roll
return {
  ok: true,
  state: {
    ...state,
    phase: 'LOOSE_BALL',
    ball: { position: state.ball.position, carrierId: null },
    lastDiceRoll: { rolls: [attackerDice, defenderDice, gkDice], context: 'HEADING_DUEL' },
  },
};
```

---

## Warnings

### WR-01: `applyRoll` SHOT branch — `WRONG_PHASE` returned when shooter/GK are missing (silently masks state corruption)

**File:** `packages/server/src/gameEngine.ts:478-484`
**Issue:** If the ball has no carrier (`state.ball.carrierId === null`) or the opposing GK is not found, `applyRoll` returns `{ ok: false, reason: 'WRONG_PHASE' }`. This mislabels what is actually a corrupted state (`PIECE_NOT_FOUND` or `CARRIER_MISSING` would be more accurate). The handler propagates `WRONG_PHASE` to the client, which will mis-diagnose the problem. The same issue applies in the HEADER branch (lines 589-595) and the PASS branch (line 438).

**Fix:** Add a dedicated reason value, or at minimum add a server-side log entry so the condition is observable:

```typescript
if (!carrier) {
  console.error(`applyRoll PASS: no carrier in state; ball=${JSON.stringify(state.ball)}`);
  return { ok: false, reason: 'WRONG_PHASE' }; // or a dedicated 'INVALID_STATE'
}
```

---

### WR-02: STEAL_ATTEMPT in `applyMove` does not handle the case where `result.effect.defenders[0]` is undefined

**File:** `packages/server/src/gameEngine.ts:217-229`
**Issue:** When a steal attempt is triggered, the code accesses `result.effect.defenders[0]` with a non-null assertion:

```typescript
const defender = result.effect.defenders[0];
const combined = computeCombinedScore(defender!.tackling, dice, []);
const stealEvent: ActionEvent = {
  type: 'STEAL_ATTEMPT',
  defenderId: defender!.id,
  ...
```

`validateMove` guarantees `defenders.length > 0` when it returns a STEAL_ATTEMPT effect (line 89 of `moveValidator.ts`). However, the `!` operator silences TypeScript, and if the invariant were ever broken (e.g. a future validator change), this would produce a runtime `TypeError: Cannot read properties of undefined` without any guard. This is an unsafe type assertion on an object that comes from an external module.

**Fix:**

```typescript
const defender = result.effect.defenders[0];
if (!defender) {
  // Defensive: validateMove guarantees defenders.length > 0 but guard for safety
  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      movedPieceIds: [...state.movedPieceIds, pieceId],
      paceUsedByPieceId: {
        ...state.paceUsedByPieceId,
        [pieceId]: (state.paceUsedByPieceId[pieceId] ?? 0) + 1,
      },
      eventLog: newEventLog,
      pendingFreeMove,
    },
  };
}
```

---

### WR-03: `applyGKRestart` 'kick' inaccurate branch sets `attackingTeam` to GK team but the MOVEMENT phase reinitialises `activeTeam` without resetting `movementSlot`

**File:** `packages/server/src/gameEngine.ts:893-913`
**Issue:** In the inaccurate-kick path, `applyGKRestart` transitions to `phase: 'MOVEMENT'` and sets `attackingTeam: gkTeam` and `activeTeam: gkTeam`. However, `movementSlot` is not reset — it inherits whatever value it had from the prior state (which in GK_RESTART should be `null`, but no defensive reset is applied). More critically, `movedPieceIds` and `paceUsedByPieceId` are not cleared:

```typescript
return {
  ok: true,
  state: {
    ...state,        // <-- carries over movedPieceIds, paceUsedByPieceId, movementSlot
    phase: 'MOVEMENT',
    attackingTeam: gkTeam,
    activeTeam: gkTeam,
    ball: { position: landing, carrierId: null },
    lastDiceRoll: { ... },
  },
};
```

If `movementSlot` is null when phase is `MOVEMENT`, the `validateMove` and `applyEndTurn` guards (`state.movementSlot === null`) will immediately reject all movement actions with `WRONG_SLOT`. This makes the game unplayable after an inaccurate GK kick until the phase is manually reset.

**Fix:** The 'movement' and 'throw' branches correctly set `movementSlot: 'ATTACKER_4'` — the 'kick' accurate/inaccurate branches must do the same:

```typescript
return {
  ok: true,
  state: {
    ...state,
    phase: 'MOVEMENT',
    movementSlot: 'ATTACKER_4',   // must be set
    movedPieceIds: [],
    paceUsedByPieceId: {},
    attackingTeam: gkTeam,
    activeTeam: gkTeam,
    ball: { position: landing, carrierId: null },
    lastDiceRoll: { ... },
  },
};
```

Wait — checking the 'movement' and 'throw' branches at lines 841-853 and 860-870: they also do NOT set `movementSlot`. They only set `phase: 'MOVEMENT'`, `attackingTeam`, and `activeTeam`. The `movementSlot` is not set in any GK restart branch. All three choices (kick, throw, movement) inherit `movementSlot: null` from the GK_RESTART state. This means `MOVEMENT` phase is unreachable without a separate event to set `movementSlot` — but no such event exists. This is the same bug for all three GK restart choices.

**Fix (revised):** Add `movementSlot: 'ATTACKER_4'`, `movedPieceIds: []`, and `paceUsedByPieceId: {}` to all three GK restart branches.

---

### WR-04: `computeCombinedScore` does not cap positive bonuses — only negative penalties are clamped

**File:** `packages/shared/src/scoreUtils.ts:27-36`
**Issue:** The `computeCombinedScore` function clamps the total penalty at `-2` via `Math.max(totalPenalty, -2)`. This is correct for penalties. However, it does not prevent callers from accidentally passing positive values in the `penalties` array (e.g. a bug in a future validator that computes a bonus instead of a penalty). A positive "penalty" would silently inflate the score beyond the intended cap with no error. This is a maintainability hazard.

**Fix:** Add a guard that asserts all penalty values are ≤ 0, or rename the parameter to make the contract explicit:

```typescript
// Development-time assertion (strip in production):
if (penalties.some((p) => p > 0)) {
  throw new Error(`computeCombinedScore: penalties must be negative; got ${penalties}`);
}
```

Or at minimum document the invariant as a JSDoc `@throws` note.

---

### WR-05: `game.integration.test.ts` — SHOT roll test directly mutates `room.gameState` via the store; if `buildInitialGameState` changes the ball default, this test silently stops covering its intent

**File:** `packages/server/src/__tests__/game.integration.test.ts:383-395`
**Issue:** The integration test sets a ball carrier by directly writing to `room.gameState`:

```typescript
room.gameState = {
  ...room.gameState,
  ball: { position: carrier.position, carrierId },
};
```

This bypasses all FSM guards. If the game state shape ever changes (e.g. `ball` is moved into a sub-object, or a new invariant is added), this test will silently continue to work while the FSM path it was meant to cover breaks. The test comment acknowledges this as a workaround but it creates a maintenance hazard.

More concretely, the test picks `carrierId = \`${state.attackingTeam}-1\``which is a DEF piece (slot 1). DEF outfielders have`highPass: 4`. The pass accuracy check uses `d1`(the first random die). At threshold 8, a DEF piece with highPass=4 needs dice ≥ 4 to get an accurate pass. Since dice are truly random in the integration test, roughly 50% of the time the pass will be inaccurate, yielding`LOOSE_BALL`rather than`SHOT`. The test asserts `['SHOT', 'LOOSE_BALL'].toContain(newState.phase)` which handles this — but the assertion is so broad it provides minimal coverage signal.

**Fix:** Use a player with deterministic behaviour (e.g. inject a mock `rollDice` for unit coverage) or pick a carrier with highPass high enough to guarantee accurate on any dice value above 2 (e.g. highPass=7). For integration tests, accept that both outcomes must be valid and document why.

---

### WR-06: `validateHandlingCheck` — handling=0 (outfielders) makes `diceValue >= handling` always true, so any outfielder trying to "handle" the ball always spills; this is correct by design but could silently allow GK_RESTART to be entered with ball.carrierId pointing to an outfielder

**File:** `packages/shared/src/shotValidator.ts:115-118`
**Issue:** `validateHandlingCheck` accepts any `PlayerPiece`, not just GKs. If it were ever called with an outfielder (handling=0), dice ≥ 0 is always true, so the result is always `caught:false`. The function contract does not document that it must only be called for GKs. If a future developer calls it with the wrong piece, they will get a silent false result with no error.

The engine currently only calls `validateHandlingCheck(gk, handlingDice)` after finding the opposing GK (line 549), so it is safe today. The risk is future misuse.

**Fix:** Add a guard or assertion:

```typescript
export function validateHandlingCheck(gk: PlayerPiece, diceValue: number): HandlingResult {
  // Handling=0 means outfielder — this function is only meaningful for GKs
  if (gk.handling === 0) return { caught: false, triggerLooseBall: true };
  ...
}
```

Or add a JSDoc `@param gk - Must be a GK piece (role === 'GK') with handling > 0`.

---

## Info

### IN-01: `applyRoll` SHOT branch — auto-miss (`shooterDice === 1`) transitions to `MOVEMENT` but does not clear `ball.carrierId`

**File:** `packages/server/src/gameEngine.ts:534-545`
**Issue:** On auto-miss, the state returned sets `ball: { position: state.ball.position, carrierId: null }`. This is correct, but the comment says "no possession change" which is contradicted by clearing `carrierId`. Clearing `carrierId` is the right behaviour (the shot missed; no one has the ball), but the comment misleads future readers. Minor documentation inconsistency.

**Fix:** Update the inline comment:

```typescript
// AUTO_MISS (dice===1) → MOVEMENT; ball becomes loose (no possession)
```

---

### IN-02: `passValidator.ts` — `validatePass` accepts `from` as an explicit parameter even though the engine always passes `piece.position` as `from`

**File:** `packages/shared/src/passValidator.ts:55-61`
**Issue:** The `from` parameter to `validatePass` is always `piece.position` at all call sites found in tests. Accepting `from` as a separate parameter creates the possibility of a caller passing a stale/incorrect `from` coordinate. The engine derives `from` server-side (T-4-03 principle), so this is fine in current code, but the extra parameter is a source of future misuse.

**Fix (optional):** Derive `from` internally: `const from = piece.position;` and remove it from the signature. This is a breaking change to the public API, so it should be batched with other validator changes.

---

### IN-03: `GameState.pendingFreeMove` and `GameState.lastDiceRoll` are optional (`?`) fields but the engine sometimes spreads `...state` and relies on them being present

**File:** `packages/shared/src/types.ts:125-135`
**Issue:** Both `pendingFreeMove` and `lastDiceRoll` are declared as optional (`?`) in the `GameState` type. This means that when code reads `state.pendingFreeMove ?? null` (gameEngine.ts line 233), TypeScript is fine — but serialised states sent over the wire and deserialised back may have these fields as `undefined` (JSON strips `undefined` but not `null`). A GameState broadcast as JSON will not include these keys if they are `undefined`, so a client receiving the state and passing it back to a server endpoint could produce a state where these fields are genuinely absent.

**Fix:** Change both fields to required with `null` as the explicit empty value:

```typescript
pendingFreeMove: { team: 'home' | 'away'; hexesAllowed: number } | null;
lastDiceRoll: {
  rolls: number[];
  context: string;
} | null;
```

This makes the absence of a dice roll explicit and prevents JSON round-trip erasure.

---

_Reviewed: 2026-05-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
