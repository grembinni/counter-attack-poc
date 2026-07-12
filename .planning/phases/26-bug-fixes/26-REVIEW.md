---
phase: 26-bug-fixes
reviewed: 2026-07-12T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - packages/server/src/gameEngine.ts
  - packages/server/src/__tests__/gameEngine.phase26-undo.test.ts
  - packages/server/src/__tests__/gameEngine.phase26-rules.test.ts
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/ActionLog.test.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-07-12
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 26 delivers three bug fixes (BUG-24 applyUndo FREE_KICK_SETUP scoping, BUG-28 header target
range reference, BUG-29 shot range constant). The BUG-24 (server) and BUG-29 (client-server parity)
fixes are correctly implemented and verified by the companion test suites. BUG-28 is fixed correctly
on the server in `applyResolveHeaderTarget` but the corresponding client-side highlight in
`HexGrid.tsx` was not updated to match, leaving a client-server mismatch for header target range
validation. One additional latent ball-state bug in `applyFreeMove`, three code-quality warnings
(hardcoded goal-line range, dead `isMovedThisStage` prop, null sequence-guard bypass), and three
info-level items round out the findings.

## Critical Issues

### CR-01: Header Target Highlight Uses Wrong Reference Position (Client-Server Mismatch)

**File:** `packages/client/src/components/HexGrid.tsx:380`

**Issue:** The BUG-28 server fix changed `applyResolveHeaderTarget` (gameEngine.ts:3409) to compute
the 6-hex range from the winning contestant's piece position
(`resolvedWinner?.position ?? state.ball.position`), not from the ball. The client highlight
logic was not updated; it still uses `ball.position` as the distance reference:

```tsx
// HexGrid.tsx:380  — BUG-28 fix was NOT mirrored here
const headerDist = headerTargetStep ? hexDistance(hex, ball.position) : Infinity;
const isHeaderTargetGoalHex = headerTargetStep && goalLineHexSet.has(hexId) && headerDist <= 6;
const isHeaderNonGoalTarget = headerTargetStep && !goalLineHexSet.has(hexId) && headerDist <= 6;
```

The winning contestant's piece can be up to 2 hexes from the ball (contestants are selected within
2 hexes of the header hex). When winner position != ball position the highlighted ring and the
accepted ring are different circles:

- Hexes within 6 of the ball but outside 6 of the winner: client shows them as valid, server
  rejects them with `INVALID_TARGET`.
- Hexes within 6 of the winner but outside 6 of the ball: server accepts them, client never
  highlights them (player cannot see or click them).

The winning contestant piece ID is not stored directly in `GameState` — the client must replicate
the `resolveHeaderWinnerPiece` selection logic (highest `aerialAbility` among
`headerContestants[winnerTeam]`) to obtain the reference position.

**Fix:**

```tsx
// In HexGrid.tsx, derive winner position with the same logic as the server
// (requires headerContestants and headerDuelWinner slices already in scope)
const headerWinnerPos = useMemo(() => {
  if (!headerTargetStep || !headerDuelWinner || !headerContestants) return null;
  const ids =
    headerDuelWinner === 'home' ? (headerContestants.home ?? []) : (headerContestants.away ?? []);
  const winner = ids
    .map((id) => pieces.find((p) => p.id === id))
    .filter(Boolean)
    .reduce<PlayerPiece | undefined>(
      (best, p) => (!best || p!.aerialAbility > best.aerialAbility ? p! : best),
      undefined,
    );
  return (winner?.position ?? ball.carrierId)
    ? (pieces.find((p) => p.id === ball.carrierId)?.position ?? ball.position)
    : ball.position;
}, [headerTargetStep, headerDuelWinner, headerContestants, pieces, ball]);

// Then replace ball.position with headerWinnerPos ?? ball.position
const headerDist =
  headerTargetStep && headerWinnerPos ? hexDistance(hex, headerWinnerPos) : Infinity;
```

Alternatively, store `headerDuelWinnerPieceId` in `GameState` (set by the handler alongside
`headerDuelWinner`) so the client can look up the piece directly without replicating selection logic.

---

## Warnings

### WR-01: `applyFreeMove` Does Not Update Ball Position When Carrier Moves

**File:** `packages/server/src/gameEngine.ts:553-578`

**Issue:** `applyFreeMove` moves the piece in `newPieces` but returns `...state` without an
explicit `ball` field. If the moving piece is the ball carrier, `state.ball.position` is left
at the pre-move hex while `state.pieces` shows the carrier at `to`. The move event's `ballAfter`
field (line 563) is always assigned `state.ball` (the stale pre-move ball state) rather than the
post-move state.

```typescript
// gameEngine.ts:563 — ballAfter never updated for carrier
const moveEvent: ActionEvent = {
  type: 'MOVE',
  pieceId,
  from: piece.position,
  to,
  slot: 'ATTACKER_2',
  timestamp: Date.now(),
  ballAfter: state.ball, // always stale when pieceId === ball.carrierId
};
// returned state has no `ball:` override — carrier position silently diverges
```

In practice, eligible free-move pieces are filtered to the opposite final third from the ball, so
the ball carrier (in the same third as the ball) cannot enter the eligible list through normal
play. However, `applyFreeMove` contains no guard enforcing this invariant, and the event log
would contain incorrect `ballAfter` data if the invariant were ever violated (e.g., a future code
path or test state that puts the carrier into `freeMoveEligibleIds`).

**Fix:** Apply the same carrier-position update pattern used in `applyMove`:

```typescript
const newBall =
  state.ball.carrierId === pieceId
    ? { ...state.ball, position: to }
    : state.ball;

const moveEvent: ActionEvent = {
  ...
  ballAfter: newBall,   // correct for both carrier and non-carrier
};

return {
  ok: true,
  state: {
    ...state,
    pieces: newPieces,
    ball: newBall,        // add explicit ball override
    eventLog: [...state.eventLog, moveEvent],
    freeMoveUsedPace: { ... },
    movedPieceIds: [...newMovedPieceIds],
  },
};
```

---

### WR-02: Goal-Line Row Range Hardcoded Instead of Using Imported `GOAL_R_VALUES`

**File:** `packages/server/src/gameEngine.ts:2493, 2580, 3428`

**Issue:** Three server-side goal-line validation checks hardcode `r >= 10 && r <= 16`:

```typescript
// line 2493 — HEADER roll branch
tgtHexB !== null && tgtHexB.q === goalQB && tgtHexB.r >= 10 && tgtHexB.r <= 16;

// line 2580 — second HEADER roll path
tgtHex !== null && tgtHex.q === goalQ && tgtHex.r >= 10 && tgtHex.r <= 16;

// line 3428 — applyResolveHeaderTarget
const isGoalLineTarget = targetHex.q === goalQ && targetHex.r >= 10 && targetHex.r <= 16;
```

`GOAL_R_VALUES` (imported at line 38) is already used correctly in two snapshot-range checks
(lines 3118, 3152). The client exclusively uses `GOAL_R_VALUES` for goal-hex highlighting. The
current hardcoded values match `GOAL_R_VALUES = [10..16]`, so there is no active mismatch. But
if `GOAL_R_VALUES` is ever updated, the server validation will silently diverge from the client
highlights and from `applyDeclareShot`'s own validation where the shared constant is not used.

**Fix:** Replace the three hardcoded predicates with a set membership check, mirroring the
snapshot-range pattern:

```typescript
import { GOAL_R_VALUES, GOAL_R_SET } from '@counter-attack/shared'; // add GOAL_R_SET export if needed
// or inline:
const isGoalLineTarget =
  targetHex.q === goalQ && GOAL_R_VALUES.includes(targetHex.r as (typeof GOAL_R_VALUES)[number]);
```

---

### WR-03: `isMovedThisStage` Prop Always Hardcoded `false` — D-55 Feature Is Dead

**File:** `packages/client/src/components/HexGrid.tsx:916`

**Issue:** The prop `isMovedThisStage` is always passed as `false` to `PieceOverlay`:

```tsx
// HexGrid.tsx:916
// D-55: green "moved this stage" ring — only during FREE_KICK_SETUP,
// for a piece already counted in this stage's freeKickPlacedPieceIds.
isMovedThisStage={false}
```

The `freeKickPlacedPieceIds` slice is subscribed on line 90 and is available. The intended
behaviour (green ring on pieces already placed in the current free-kick stage) is described in the
D-55 comment but never wired up. The orange activated ring (`isSpentNow`) works correctly for
placed pieces; `isMovedThisStage` is a separate, entirely disabled signal, making it vestigial
dead code in PieceOverlay's prop surface.

**Fix:** Compute the prop from `freeKickPlacedPieceIds` at the call site:

```tsx
isMovedThisStage={
  phase === 'FREE_KICK_SETUP' &&
  (freeKickPlacedPieceIds ?? []).includes(piece.id)
}
```

---

### WR-04: `applyDeclareShot` Skips SHOT Eligibility Guard When `lastActionType` Is Null

**File:** `packages/server/src/gameEngine.ts:3628-3633`

**Issue:** The sequence eligibility guard is wrapped in a null check:

```typescript
// gameEngine.ts:3628
if (state.lastActionType !== null) {
  const eligible = ELIGIBLE_NEXT_ACTIONS[state.lastActionType];
  if (!eligible.has('SHOT')) {
    return { ok: false, reason: 'INVALID_SEQUENCE' };
  }
}
// no guard fires when lastActionType === null
```

When `lastActionType` is `null` any caller reaching this point can declare a shot without a
preceding eligible action. In normal gameplay `lastActionType` is not null in PASS phase (the only
phase that passes the phase guard above), so the bypass is unreachable through the standard
game flow. However, a crafted or recovered game state (e.g., a room re-hydrated from an
edge-case snapshot) could carry `lastActionType: null` in PASS phase and allow an unsequenced
shot declaration.

**Fix:** Make the null case an explicit rejection rather than a silent bypass:

```typescript
if (state.lastActionType === null) {
  return { ok: false, reason: 'INVALID_SEQUENCE' };
}
const eligible = ELIGIBLE_NEXT_ACTIONS[state.lastActionType];
if (!eligible.has('SHOT')) {
  return { ok: false, reason: 'INVALID_SEQUENCE' };
}
```

---

## Info

### IN-01: `canUndo` FREE_MOVE Guard Checks Wrong Pace Tracking Field

**File:** `packages/client/src/components/ActionPanel.tsx:240-243`

**Issue:** The Bug-C early-exit guard that disables Undo when no moves exist checks
`paceUsedByPieceId` for all three movement-like phases including FREE_MOVE:

```typescript
if (
  (phase === 'MOVE' || phase === 'FREE_MOVE_ATTACK' || phase === 'FREE_MOVE_DEFENSE') &&
  Object.keys(paceUsedByPieceId).length === 0
)
  return false;
```

`applyFreeMove` does not write to `paceUsedByPieceId` — it writes to `freeMoveUsedPace`. So
`paceUsedByPieceId` is always `{}` during FREE_MOVE phases, and this guard permanently returns
`false` (undo disabled) even when free moves have been made. Currently benign because neither
`FREE_MOVE_ATTACK` nor `FREE_MOVE_DEFENSE` panels render an Undo button. If an Undo button is
ever added to those panels, undo will appear permanently disabled.

**Fix:** Use the correct tracking field for FREE_MOVE phases:

```typescript
if (phase === 'MOVE' && Object.keys(paceUsedByPieceId).length === 0) return false;
if (
  (phase === 'FREE_MOVE_ATTACK' || phase === 'FREE_MOVE_DEFENSE') &&
  Object.keys(freeMoveUsedPace ?? {}).length === 0
)
  return false;
```

---

### IN-02: `applyStartMovement` Docstring Incorrectly Claims It Appends a KICK_OFF Event

**File:** `packages/server/src/gameEngine.ts:434`

**Issue:** The JSDoc for `applyStartMovement` includes the statement "Appends a KICK_OFF
ActionEvent to mark the kick-off→movement edge." The implementation returns
`eventLog: state.eventLog` — it does not append any event. The KICK_OFF event is actually
emitted by `gameHandlers.ts` (line 1832) during the KICK_OFF_SETUP → KICK_OFF transition,
before this function is ever called.

Both `applyUndo` (line 1397) and `canUndo` in ActionPanel (line 255) reference a `KICK_OFF`
event type as a slot boundary. The boundary works at match kick-off because the handler already
put the event in the log. After steal/tackle possession changes, no second KICK_OFF event is
emitted (by handler or engine), but the Bug-C guard (`paceUsedByPieceId` empty check) prevents
undo from crossing the possession boundary in practice.

The misleading docstring implies a responsibility this function does not own and will confuse
future maintainers debugging undo-boundary behaviour after possession changes.

**Fix:** Update the docstring to reflect reality:

```
* Does NOT append any event to the log — the KICK_OFF ActionEvent that marks the
* kick-off→movement boundary is emitted by the gameHandlers.ts kick-off-setup handler
* (see the KICK_OFF_SETUP ready-up block). After steal/tackle-induced possession changes,
* no new boundary event is needed; the Bug-C guard in canUndo/applyUndo prevents
* cross-possession undo by tracking paceUsedByPieceId.
```

---

### IN-03: `FTP_MOVE_ENABLED = false` Permanent Feature Flag Disables Sub-Phase

**File:** `packages/server/src/gameEngine.ts:85`

**Issue:** `const FTP_MOVE_ENABLED = false;` permanently disables the FIRST_TIME_PASS_MOVE
repositioning sub-phase (BUG-12 mitigation). The constant is referenced in `applyMove` to skip
the FTP_REPOSITION phase entry. Dead code branches for that sub-phase remain throughout the
engine. The flag has never been `true` in this codebase revision and there is no tracking ticket
or roadmap entry tying it to a future milestone.

If the intent is permanent removal, the dead code and flag should be deleted. If the intent is
future re-enablement, the feature should be tracked explicitly.

**Fix (option A — remove permanently):** Delete `FTP_MOVE_ENABLED`, the `FTP_REPOSITION` phase
branch in `applyMove`, the `FIRST_TIME_PASS_MOVE` phase handling in `applyUndo`, and any related
dead state fields.

**Fix (option B — track intent):** Add a comment referencing the roadmap item or issue that would
re-enable it, so reviewers know this is deliberate deferral rather than forgotten code.

---

_Reviewed: 2026-07-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
