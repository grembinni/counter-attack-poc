# Phase 26: Bug Fixes — Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 4 (3 server, 1+ client components)
**Analogs found:** 6 / 6 (all are modifications to existing functions — self-analogs)

---

## File Classification

| Modified File                                                                     | Role           | Data Flow        | Closest Analog              | Match Quality                    |
| --------------------------------------------------------------------------------- | -------------- | ---------------- | --------------------------- | -------------------------------- |
| `packages/server/src/gameEngine.ts` (`applyUndo`)                                 | service/engine | event-driven     | self (lines 1388–1560)      | exact — extend existing function |
| `packages/client/src/components/ActionPanel.tsx` (`ctaButtonClass` usage in MOVE) | component      | request-response | self (lines 46–48, 971–976) | exact — fix call-site            |
| `packages/client/src/components/HexGrid.tsx` (`handleClick` chain)                | component      | event-driven     | self (lines 853–892)        | exact — extend chain             |
| `packages/client/src/components/ActionLog.tsx` (`DEFLECT_ATTEMPT` case)           | component      | transform        | self (lines 305–327)        | exact — inspect render paths     |
| `packages/server/src/gameEngine.ts` (`applyResolveHeaderTarget`)                  | service/engine | request-response | self (lines 3386–3455)      | exact — extend validation        |
| `packages/server/src/gameEngine.ts` (`applyDeclareShot`)                          | service/engine | request-response | self (lines 3584–3647)      | exact — investigate constant     |

---

## Pattern Assignments

### BUG-24 — `applyUndo` + `canUndo` (undo scoping for MOVE and FREE_KICK_SETUP)

**Files:** `packages/server/src/gameEngine.ts` lines 1388–1560 and `packages/client/src/components/ActionPanel.tsx` lines 230–270

**Established boundary-detection pattern** (`gameEngine.ts` lines 1394–1403):

```typescript
const lastSlotAdvanceIdx = state.eventLog.reduce<number>((acc, evt, idx) => {
  const isBoundary =
    evt.type === 'SLOT_ADVANCE' ||
    evt.type === 'KICK_OFF' ||
    (state.phase === 'HIGH_PASS_MOVE' && evt.type === 'HP_REPOSITION') ||
    (state.phase === 'FIRST_TIME_PASS_MOVE' && evt.type === 'FTP_REPOSITION') ||
    (state.phase === 'FREE_KICK_SETUP' &&
      (evt.type === 'FK_KICKER_CHOSEN' || evt.type === 'FK_STAGE_ADVANCE'));
  return isBoundary ? idx : acc;
}, -1);
```

**Nothing-to-undo / locked gate** (`gameEngine.ts` lines 1433–1441):

```typescript
if (lastMoveRelIdx === -1) {
  const hasPriorMoves = state.eventLog
    .slice(0, lastSlotAdvanceIdx + 1)
    .some((e) => e.type === moveTypeForPhase);
  if (hasPriorMoves) {
    return { ok: false, reason: 'UNDO_LOCKED' };
  }
  return { ok: false, reason: 'NOTHING_TO_UNDO' };
}
```

**FK_SETUP_MOVE lock-reset pattern** (`gameEngine.ts` lines 1538–1543):

```typescript
: state.phase === 'FREE_KICK_SETUP'
  ? {
      freeKickPlacedPieceIds: (state.freeKickPlacedPieceIds ?? []).filter(
        (id) => id !== moveToUndo.pieceId,
      ),
    }
  : {};
```

**Client `canUndo` gate for empty MOVE slot** (`ActionPanel.tsx` lines 239–243):

```typescript
if (
  (phase === 'MOVE' || phase === 'FREE_MOVE_ATTACK' || phase === 'FREE_MOVE_DEFENSE') &&
  Object.keys(paceUsedByPieceId).length === 0
)
  return false;
```

**Client `canUndo` boundary scan for FREE_KICK_SETUP** (`ActionPanel.tsx` lines 249–252):

```typescript
phase === 'FREE_KICK_SETUP' && (evt.type === 'FK_KICKER_CHOSEN' || evt.type === 'FK_STAGE_ADVANCE');
```

**BUG-24 fix targets:**

- **D-03:** Client `canUndo` must return `false` when `phase === 'FREE_KICK_SETUP' && freeKickPlacedPieceIds.length === 0`. Add this guard (mirroring the `paceUsedByPieceId` MOVE guard at lines 239–243) before the boundary scan.
- **D-04:** Server `applyUndo` already treats `FK_STAGE_ADVANCE` / `FK_KICKER_CHOSEN` as boundaries (line 1400–1401). Verify the `NOTHING_TO_UNDO` path correctly fires when `freeKickPlacedPieceIds` is empty — if the event scan finds no `FK_SETUP_MOVE` after the last boundary, it already returns `NOTHING_TO_UNDO` (line 1441). Confirm this matches D-03 intent.
- **D-05:** Existing `paceUsedByPieceId` empty-map guard (lines 239–243) already covers non-FK MOVE phases. No server change needed for MOVE-phase undo scoping.

---

### BUG-25 — `ctaButtonClass` in MOVE phase End Turn button (`ActionPanel.tsx`)

**Analog:** `ctaButtonClass` definition (`ActionPanel.tsx` lines 46–48):

```typescript
function ctaButtonClass(eligibleRemaining: number): string {
  return eligibleRemaining <= 0 ? (styles.ctaButtonReady ?? '') : (styles.ctaButtonPending ?? '');
}
```

**Correct usage pattern** (HEADER phase, `ActionPanel.tsx` lines 459–462):

```typescript
<button
  className={`${styles.ctaButton} ${ctaButtonClass(headerEligibleRemaining)}`}
  onClick={withEndTurnConfirm(headerEligibleRemaining, () =>
    emitHeaderContestant(headerContestantIds),
  )}
>
```

**Incorrect current pattern — MOVE phase End Turn** (`ActionPanel.tsx` lines 971–976):

```typescript
<button
  className={`${styles.ctaButton} ${styles.ctaButtonReady ?? ''}`}
  title={ACTION_SUMMARY['End Turn']}
  onClick={withEndTurnConfirm(remaining ?? 0, emitEndTurn)}
>
  End Turn
</button>
```

**BUG-25 fix:** Replace `styles.ctaButtonReady ?? ''` with `ctaButtonClass(remaining ?? 0)` so the End Turn button shows orange (pending) while `remaining > 0` and green (ready) when `remaining <= 0`. Pattern to copy from the HEADER phase button at line 459.

---

### BUG-26 — `handleClick` opponent piece routing (`HexGrid.tsx`)

**Analog:** Existing `handleClick` chain terminal branches (`HexGrid.tsx` lines 883–892):

```typescript
: canSelect
  ? () => selectPiece(piece.id)
  : // BUG-10: clicking an already-moved own-team piece in MOVE opens its
    // player card via inspectPiece — same as unmoved pieces — but does NOT
    // re-trigger move-target highlighting.
    phase === 'MOVE' &&
      myTeam !== null &&
      piece.teamId === myTeam &&
      movedPieceIds.includes(piece.id)
    ? () => inspectPiece(piece.id)
    : () => undefined;
```

**`inspectPiece` wiring** (already wired to `onInspect`, `ActionPanel.tsx` line 902):

```typescript
onInspect={() => inspectPiece(piece.id)}
```

**BUG-26 fix:** The `handleClick` chain's final branch only calls `inspectPiece` for own moved pieces. Opponent pieces whose click falls through every earlier condition hit `() => undefined`. Add a branch before `() => undefined` that calls `inspectPiece(piece.id)` for opponent pieces that are already activated (`movedPieceIds.includes(piece.id)` and `piece.teamId !== myTeam`). Pattern mirrors the BUG-10 branch immediately above it — same inspectPiece call, different team guard.

**Guard pattern to copy** (lines 887–891 — own moved piece branch):

```typescript
phase === 'MOVE' &&
  myTeam !== null &&
  piece.teamId === myTeam &&
  movedPieceIds.includes(piece.id)
? () => inspectPiece(piece.id)
```

New branch should be:

```typescript
: movedPieceIds.includes(piece.id)  // opponent's activated piece — view-only card
? () => inspectPiece(piece.id)
: () => undefined;
```

(Remove the `myTeam === piece.teamId` constraint; the branch fires only after `canSelect` is already false for non-active-team pieces, so no erroneous selectPiece call can occur.)

---

### BUG-27 — `DEFLECT_ATTEMPT` log format (`ActionLog.tsx`)

**Current implementation** (`ActionLog.tsx` lines 305–326):

```typescript
case 'DEFLECT_ATTEMPT': {
  const deflected = event.result === 'DEFLECTED';
  const dColor = pieceColorOf(event.defenderId);
  const hasBonus = event.band === 'A' && event.die < 5;
  const rollStr = hasBonus
    ? `die ${event.die} + Tackling ${event.tackling} = ${event.die + event.tackling}`
    : `die ${event.die}`;
  const rangeLabel = event.band === 'A' ? 'close range (Set A)' : 'long range (Set B)';
  return {
    prefix: deflected ? '[DEFLECT ✓]' : '[DEFLECT ✗]',
    prefixColor: dColor,
    content: (
      <>
        {' '}
        <PNamed pieceId={event.defenderId} />{' '}
        {deflected ? 'deflected the shot' : 'failed to deflect'} — {rangeLabel}, {rollStr}
      </>
    ),
    isGoal: false,
  };
}
```

**BUG-27 investigation note:** The current code appears to always include `— {rangeLabel}, {rollStr}` for both deflected and failed branches. Verify whether `event.band`, `event.die`, or `event.tackling` can be `undefined`/`null` on some server paths (e.g. auto-pass / no-contest deflect), which would silently suppress the suffix. The fix is to guard against undefined fields and provide a fallback string. No new pattern is needed — this is a defensive check of the existing case.

---

### BUG-28 — `applyResolveHeaderTarget` range validation (`gameEngine.ts`)

**Current validation** (`gameEngine.ts` lines 3406–3409):

```typescript
const referencePosition = resolvedWinner?.position ?? state.ball.position;

// 4. D-06: validate targetHex within 6 hexes of the winning contestant's position
if (hexDistance(referencePosition, targetHex) > 6) {
  return { ok: false, reason: 'INVALID_TARGET' };
}
```

**Goal-line routing** (`gameEngine.ts` lines 3423–3424):

```typescript
const goalQ = winnerTeam === 'home' ? 36 : 0;
const isGoalLineTarget = targetHex.q === goalQ && targetHex.r >= 10 && targetHex.r <= 16;
```

**BUG-28 investigation note:** The range check uses `referencePosition` (winning contestant's position fallback to ball position). The bug may be that `resolvedWinner?.position` is null/undefined when the winner's piece hasn't been properly resolved, causing the fallback to `state.ball.position`, which may be further away. Investigate `resolveHeaderWinnerPiece` return value. The fix pattern is the existing validation block — confirm `referencePosition` is always the contestant piece's actual position, not the ball.

---

### BUG-29 — `applyDeclareShot` range constant (`gameEngine.ts`)

**Current range gate** (`gameEngine.ts` lines 3642–3645):

```typescript
// D-09: regular shot range gate — goal hex must be within 11 hexes of the shooter.
if (!shooter || hexDistance(shooter.position, goalHex) > 11) {
  return { ok: false, reason: 'INVALID_TARGET' };
}
```

**Client-side range gate** (`ActionPanel.tsx` line 773):

```typescript
const showShoot = eligible.has('SHOT') && dist <= 11;
```

**BUG-29 investigation note:** Both client and server use `11` as the range constant. If BUG-29 is about incorrect hexes being highlighted or blocked, check whether `hexDistance` is returning offset vs. cube coordinate results. The `hexDistance` import comes from `@counter-attack/shared` (ActionPanel line 7). Verify the shared function uses cube coordinates consistent with piece `position` fields. No constant change needed until root cause confirmed.

---

## Shared Patterns

### `applyXxx` Pure-Function Convention

**Source:** `packages/server/src/gameEngine.ts` (all exported `applyXxx` functions)
**Apply to:** All server-side fixes (BUG-24, BUG-28, BUG-29)

All game-state mutations return `{ ok: true, state: GameState } | { ok: false, reason: string }`. Callers in `gameHandlers.ts` handle the `ok: false` case and emit errors. Do not throw — return a typed error reason.

### Client `canUndo` / Server `applyUndo` Sync Invariant

**Source:** `ActionPanel.tsx` lines 230–270 and `gameEngine.ts` lines 1388–1403
**Apply to:** BUG-24

Both client `canUndo` and server `applyUndo` must agree on boundary events and empty-state guards. When adding a new phase guard on the client, add the corresponding server-side guard (or confirm the existing one covers it). The two blocks use structurally identical `eventLog.reduce` patterns — copy the shape exactly.

### `ctaButtonClass` Pattern

**Source:** `ActionPanel.tsx` lines 46–48
**Apply to:** BUG-25

Every End Turn button that uses `withEndTurnConfirm(eligibleRemaining, ...)` should also use `ctaButtonClass(eligibleRemaining)` for the className. Hardcoded `styles.ctaButtonReady` is wrong when players remain.

### `handleClick` Ternary Chain Extension

**Source:** `HexGrid.tsx` lines 853–892
**Apply to:** BUG-26

The chain is a deeply-nested ternary. New branches are added just before the final `() => undefined` fallback. Always keep `() => undefined` as the last else.

---

## No Analog Found

None — all six bugs are modifications to existing code paths with clear self-analogs.

---

## Metadata

**Analog search scope:** `packages/server/src/gameEngine.ts`, `packages/client/src/components/ActionPanel.tsx`, `packages/client/src/components/HexGrid.tsx`, `packages/client/src/components/ActionLog.tsx`
**Files scanned:** 4
**Pattern extraction date:** 2026-07-12
