---
phase: 11-rule-correctness
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/store/useGameStore.rule11.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/server/src/__tests__/gameEngine.rule11.test.ts
  - packages/server/src/__tests__/gameHandlers.phase10.test.ts
  - packages/server/src/__tests__/gameHandlers.rule11.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/shared/src/events.ts
  - packages/shared/src/types.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 11 adds RULE-01 (high-pass accuracy acknowledgment gate before contestant selection), RULE-02 (header duel winner pre-computed in `GAME_HEADER_CONTESTANT` and used as the guard on `GAME_HEADER_TARGET`), RULE-03 (`lastShotPath` cleared on all LOOSE_BALL exit paths), RULE-04 (SNAP_DEFLECT pace guard in client store), and RULE-05 (post-deflect MOVEMENT selectability). The engine transitions and test coverage are largely correct. Three blockers were found: `computeHeaderDuelWinner` silently omits the `validateHeading` distance penalty that `applyRoll` applies, producing divergent winner determinations in contested duels; `applyResolveHeaderTarget` always resolves the winning piece from `winnerContestantIds[0]` regardless of which contestant scored highest; and the goal-line routing in `applyResolveHeaderTarget` always uses `state.attackingTeam` for goal direction, making defender-win-to-goal headers route to PASS instead of GK_DIVING. Five warnings and three info items cover a stale `lastShotPath` on inaccurate GK kick, a missing pitch-boundary check in KICK_OFF_SETUP free repositioning, a GAME_ROLL re-duel attack surface in HEADER phase, a spurious broadcastState on double-ACK, and two minor test quality defects.

---

## Critical Issues

### CR-01: `computeHeaderDuelWinner` omits the `validateHeading` distance penalty, diverging from `applyRoll`

**File:** `packages/server/src/gameEngine.ts:2195-2241`

**Issue:** `applyRoll` HEADER branch (lines 1543-1552) calls `validateHeading` to obtain `penaltyMod` and passes it to `computeCombinedScore(attackerPiece.heading, attackerDie, [penaltyMod])`. `computeHeaderDuelWinner` (line 2201) always calls `computeCombinedScore(piece.heading, die, [])` — an empty penalty array — for every contestant. The GAME_HEADER_CONTESTANT handler calls `computeHeaderDuelWinner` to pre-compute `headerDuelWinner`; under RULE-02 the HEADER case in `applyRoll` is never called afterward. The attacker's adjusted score therefore ignores any distance/challenge penalty, and the winner stored in `headerDuelWinner` may differ from what a penalty-aware computation would produce. This means an attacker who should have lost the heading duel due to a distance penalty can be incorrectly recorded as the winner.

**Fix:** Mirror the `validateHeading` call inside `computeHeaderDuelWinner`. After `attackerWinner` and `defenderWinner` are resolved:

```typescript
// In computeHeaderDuelWinner, after resolving attackerWinner / defenderWinner:
if (attackerWinner && defenderWinner) {
  const headResult = validateHeading(state, attackerWinner.piece, state.ball.position, {
    previousActionWasHeadedPass: false,
    otherChallengerIds: [defenderWinner.piece.id],
  });
  const penaltyMod = headResult.ok && headResult.contested ? headResult.penaltyModifier : 0;
  const adjustedAtk = computeCombinedScore(attackerWinner.piece.heading, attackerWinner.die, [
    penaltyMod,
  ]);
  const adjustedDef = computeCombinedScore(defenderWinner.piece.heading, defenderWinner.die, []);
  if (adjustedAtk > adjustedDef) return state.attackingTeam;
  if (adjustedAtk < adjustedDef) return defenderTeam;
  return null; // tie
}
```

---

### CR-02: `applyResolveHeaderTarget` resolves winner piece from `winnerContestantIds[0]` — wrong piece when multiple were nominated

**File:** `packages/server/src/gameEngine.ts:2293-2303`

**Issue:** Lines 2293-2297:

```typescript
const winnerContestantIds =
  winnerTeam === 'home'
    ? (state.headerContestants?.home ?? [])
    : (state.headerContestants?.away ?? []);
const winnerContestantId = winnerContestantIds[0];
const winnerPiece = state.pieces.find((p) => p.id === winnerContestantId);
```

`computeHeaderDuelWinner` picks the highest-scoring contestant within the winning team via `pickWinner`, but `applyResolveHeaderTarget` ignores that and always uses index `[0]`. If a team nominated multiple contestants (allowed by the UI — "multiple allowed" per store comment), and a non-first contestant won the intra-team tiebreak, the wrong piece is used as the reference for:

- The 6-hex range guard (line 2306): `hexDistance(referencePosition, targetHex) > 6` uses the wrong position
- The GK_DIVING ball origin and `lastShotPath` computation (lines 2334-2335)
- The PASS ball carrier ID (line 2364)

This can allow an out-of-range target to pass validation (if the first contestant is closer to the target than the actual winner), or reject a valid in-range target.

**Fix:** Store the winning piece ID separately. The simplest fix is to replace the `[0]` index with the actual highest-scoring piece lookup:

```typescript
// Replace the winnerContestantId line with:
const winnerContestantId = winnerContestantIds.reduce<string | undefined>((bestId, id) => {
  const p = state.pieces.find((x) => x.id === id);
  const best = bestId ? state.pieces.find((x) => x.id === bestId) : undefined;
  return !p ? bestId : !best || p.heading > best.heading ? id : bestId;
}, undefined);
```

A more robust fix is to add `headerDuelWinnerPieceId: string | null` to `GameState` and set it in the handler alongside `headerDuelWinner`.

---

### CR-03: `applyResolveHeaderTarget` uses `state.attackingTeam` (original attacker) for goal-line direction even when the defender wins

**File:** `packages/server/src/gameEngine.ts:2321-2323`

**Issue:**

```typescript
const attackingTeamForHeader = state.headerDuelWinner ?? state.attackingTeam;
const goalQ = attackingTeamForHeader === 'home' ? 36 : 0;
const isGoalLineTarget = targetHex.q === goalQ && targetHex.r >= 10 && targetHex.r <= 16;
```

The comment on line 2321 says "Use the duel winner's team as the effective attacker", and `attackingTeamForHeader` does read from `headerDuelWinner`. However `state.headerDuelWinner` at this point has already been cleared to `null` by the `headerCleared` spread applied at line 2310-2316. Since `headerCleared.headerDuelWinner = null`, the `?? state.attackingTeam` fallback always activates, making `attackingTeamForHeader` always equal to the original attacker regardless of who won.

This means: when the defender wins and submits a target at `q=0` (their attacking goal), `goalQ` is computed as 36 (original attacker's goal), `isGoalLineTarget` is false, and the transition incorrectly goes to PASS rather than GK_DIVING. The defending team's goal-line header is treated as a regular headed pass.

**Fix:** Read `winnerTeam` (already defined at line 2289) before the `headerCleared` spread:

```typescript
// Replace lines 2321-2323 with:
const goalQ = winnerTeam === 'home' ? 36 : 0;
const isGoalLineTarget = targetHex.q === goalQ && targetHex.r >= 10 && targetHex.r <= 16;
```

`winnerTeam` is set on line 2289 before `headerCleared` is constructed, so it captures the correct value.

---

## Warnings

### WR-01: Inaccurate GK kick branch in `GAME_END_TURN` handler inherits stale `lastShotPath`

**File:** `packages/server/src/gameHandlers.ts:654-671`

**Issue:** When the GK kick accuracy check fails, the handler spreads `...gkEndState` and sets `phase: 'LOOSE_BALL'` but does not include `lastShotPath: null`. If `gkEndState.lastShotPath` is non-null (from a prior shot earlier in the same possession), the stale path persists and is broadcast to both clients. `HexGrid` will continue rendering golden shot-path hexes over the entire prior shot trajectory during the LOOSE_BALL phase.

The same spread at line 638 (accurate kick → PASS) does not include `lastShotPath: null` either, though the PASS path is less visible.

**Fix:** Add `lastShotPath: null` to both the accurate and inaccurate GK kick result spreads:

```typescript
room.gameState = {
  ...gkEndState,
  phase: 'LOOSE_BALL',
  ball: { position: targetHex, carrierId: null },
  // ...existing fields...
  lastShotPath: null, // add this
  // ...
};
```

---

### WR-02: `GAME_KICK_OFF_MOVE` handler allows repositioning to off-pitch hexes and opponent-occupied hexes

**File:** `packages/server/src/gameHandlers.ts:1382-1386`

**Issue:** The KICK_OFF_SETUP free-repositioning handler applies the new piece position with no pitch-boundary or occupancy check:

```typescript
const newPieces = room.gameState.pieces.map((p) =>
  p.id === pieceId ? { ...p, position: { q: to.q, r: to.r } } : p,
);
room.gameState = { ...room.gameState, pieces: newPieces };
broadcastState(io, room);
```

A client can send an arbitrary `to` coordinate. `applyKickOffReady` will eventually reject the formation, but until then: (1) the invalid position is broadcast to both clients, (2) a piece can be stacked on an opponent piece (the move validator only excludes same-team pieces at `to`), and (3) a piece can be placed off-pitch, which would corrupt any subsequent hex-distance or region check that relies on pitch-valid positions.

**Fix:** Add boundary and occupancy guards before applying the move:

```typescript
if (!PITCH_HEXES.some((h) => h.q === to.q && h.r === to.r)) {
  socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
  broadcastState(io, room);
  return;
}
if (
  room.gameState.pieces.some(
    (p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r,
  )
) {
  socket.emit(ServerEvents.GAME_ERROR, 'OCCUPIED');
  broadcastState(io, room);
  return;
}
```

---

### WR-03: `GAME_ROLL` handler in HEADER phase can re-fire the heading duel after `headerDuelWinner` is already set

**File:** `packages/server/src/gameHandlers.ts:1089-1105`

**Issue:** `DICE_PHASES` (line 75) includes `'HEADER'`. After RULE-02, the duel is fired in `GAME_HEADER_CONTESTANT` and `headerDuelWinner` is set. GAME_HEADER_TARGET resolves the phase. However, GAME_ROLL is still accepted in HEADER phase if both teams have confirmed (lines 1089-1105 gate on `headerConfirmed.home && headerConfirmed.away`). Calling GAME_ROLL at this point invokes `applyRoll` HEADER branch, which re-computes a full contested duel with fresh dice, overwriting `headerDuelWinner` with a second result. This gives an attacker who lost the duel the ability to re-roll by sending GAME_ROLL until a favourable outcome appears — a game-breaking exploit.

**Fix:** Remove `'HEADER'` from `DICE_PHASES`, or add an explicit guard in the GAME_ROLL handler:

```typescript
// Inside the GAME_ROLL handler, after the team guard:
if (room.gameState.phase === 'HEADER' && room.gameState.headerDuelWinner !== undefined) {
  socket.emit(ServerEvents.GAME_ERROR, 'DUEL_ALREADY_RESOLVED');
  broadcastState(io, room);
  return;
}
```

---

### WR-04: `GAME_HEADER_ACCURACY_ACK` handler has no guard against redundant ACK after flag is already null

**File:** `packages/server/src/gameHandlers.ts:1756-1782`

**Issue:** The handler checks `phase === 'HEADER'` and `controlsAttackingTeam`, then unconditionally sets `headerAccuracyRollPending: null` and calls `broadcastState`. There is no check that `headerAccuracyRollPending` is actually `true` before acting. A network retry or malicious double-send from the attacker after the flag was cleared will trigger a spurious `broadcastState` during the contestant-selection window. `setGameState` on the client processes every broadcast: even though no phase change occurs, the client store's `gameError: null` wipe and other side effects (from the non-sticky clear path) run if any condition triggers the clear branch. This can reset `headerContestantIds` if `phaseChanged` happens to evaluate differently due to timing.

**Fix:** Add a flag-presence guard:

```typescript
if (!room.gameState.headerAccuracyRollPending) {
  // Flag already cleared — snap back without state mutation
  broadcastState(io, room);
  return;
}
```

---

### WR-05: `applyDeclareHeaderTarget` is exported but dead — superseded by `applyResolveHeaderTarget` with no callsite

**File:** `packages/server/src/gameEngine.ts:2129-2161`

**Issue:** `applyDeclareHeaderTarget` was the original engine function for GAME_HEADER_TARGET. After RULE-02, the GAME_HEADER_TARGET handler calls `applyResolveHeaderTarget` instead. `applyDeclareHeaderTarget` has no callsite in production code and no test that directly exercises it (the test file uses `applyResolveHeaderTarget`). It is dead exported code that could mislead future contributors into thinking it is the active path.

**Fix:** Remove `applyDeclareHeaderTarget` and its exported type `ApplyDeclareHeaderTargetResult`, or explicitly deprecate it with a `@deprecated` JSDoc comment pointing to `applyResolveHeaderTarget`.

---

## Info

### IN-01: `gameEngine.rule11.test.ts` distance-6 boundary test has a vacuous inner assertion

**File:** `packages/server/src/__tests__/gameEngine.rule11.test.ts:313-326`

**Issue:** The test "accepts a hex exactly at distance 6 from winner position" at lines 319-322 reads:

```typescript
const result7 = applyResolveHeaderTarget(state, { q: 34, r: 12 });
expect(result7.ok).toBe(false);
if (!result7.ok) expect(result7.reason).toBe('INVALID_TARGET');
if (!result.ok) {
  expect(result.reason).not.toBe('DUEL_NOT_RESOLVED');
}
```

The distance-6 (`result`) check at lines 323-325 is conditional: if `result.ok === true` the inner expectation is skipped. If `result.ok === false`, the reason is asserted not to be `DUEL_NOT_RESOLVED` — but it could be `INVALID_TARGET` (wrong rejection) and still pass. The test's declared intent ("accepts a hex exactly at distance 6") is not enforced.

**Fix:**

```typescript
// Assert the distance-6 case either succeeds or fails for a reason other than INVALID_TARGET:
if (result.ok === false) {
  expect(result.reason).not.toBe('INVALID_TARGET');
}
```

Or preferably assert `result.ok` directly to be `true` after verifying `{q:33,r:12}` is a valid pitch hex.

---

### IN-02: `useGameStore.rule11.test.ts` `beforeEach` does not reset `shootingMode`, `selectedPassType`, or `headerContestantIds`

**File:** `packages/client/src/store/useGameStore.rule11.test.ts:88-101`

**Issue:** The `beforeEach` resets `selectedPieceId`, `validMoveHexes`, `tackleRiskHexes`, `playerSlot`, `roomCode`, `disconnectWarning`, `roomError`, and `gameError` — but omits `shootingMode`, `selectedPassType`, `validPassTargetHexes`, `interceptionRiskHexes`, `headerContestantIds`, `lastMovedPieceId`, and `screen`. If any test sets these fields, subsequent tests may observe residual values. The current suite is small enough to be unaffected, but this fragile ordering dependency grows with coverage.

**Fix:** Extend `beforeEach` to reset all store slices to their initial values, or expose a `resetStore()` helper that restores the full initial shape.

---

### IN-03: `GAME_HEADER_ACCURACY_ACK` and `GAME_HEADER_CONTESTANT` handler `finally` blocks have incorrect Pitfall comment ("Pitfall 2" vs "Pitfall 5")

**File:** `packages/server/src/gameHandlers.ts:1780,1953`

**Issue:** Both `finally` blocks read `// MUST be in finally — Pitfall 2`. The correct reference throughout the rest of the file is Pitfall 5 (isProcessing released in finally — never conditionally). Pitfall 2 is the "never read socket.rooms" anti-pattern. This is cosmetic but creates confusion for code archaeology.

**Fix:** Change both instances to `// MUST be in finally — Pitfall 5`.

---

_Reviewed: 2026-06-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
