---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
reviewed: 2026-08-04T17:36:44Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - packages/client/src/App.test.tsx
  - packages/client/src/App.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/BallLocationRing.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameSettingsScreen.test.tsx
  - packages/client/src/components/GameSettingsScreen.tsx
  - packages/client/src/components/GoalKickSetupPanel.module.css
  - packages/client/src/components/GoalKickSetupPanel.test.tsx
  - packages/client/src/components/GoalKickSetupPanel.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/ThrowInSetupPanel.module.css
  - packages/client/src/components/ThrowInSetupPanel.test.tsx
  - packages/client/src/components/ThrowInSetupPanel.tsx
  - packages/client/src/constants/settingsSummary.ts
  - packages/client/src/mock/mockMovementState.ts
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/server/src/__tests__/draftReconnect.integration.test.ts
  - packages/server/src/__tests__/draftSession.integration.test.ts
  - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts
  - packages/server/src/__tests__/goalKick.integration.test.ts
  - packages/server/src/__tests__/room.integration.test.ts
  - packages/server/src/__tests__/roomStore.test.ts
  - packages/server/src/__tests__/testHelpers.ts
  - packages/server/src/__tests__/throwIn.integration.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/server/src/roomHandlers.ts
  - packages/server/src/roomStore.ts
  - packages/shared/src/actionSequence.test.ts
  - packages/shared/src/actionSequence.ts
  - packages/shared/src/events.ts
  - packages/shared/src/index.ts
  - packages/shared/src/offside.ts
  - packages/shared/src/outOfBounds.test.ts
  - packages/shared/src/outOfBounds.ts
  - packages/shared/src/passValidator.test.ts
  - packages/shared/src/passValidator.ts
  - packages/shared/src/types.ts
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-08-04T17:36:44Z
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

This is a re-review of the Phase 37 out-of-bounds/throw-in/goal-kick implementation after the `37-11`/`37-12` gap-closure plans. The prior review's BLOCKER (CR-01, stale throw-in tracking state) and both WARNINGs (WR-01 dead ternary, WR-02 wasted die roll) were independently re-verified against the current code and are confirmed fixed:

- `THROW_IN_TEARDOWN` is now spread at all six early-return/teardown sites in `gameEngine.ts` (`applyMove`'s tackle-success/steal-success/defending-pickup returns, `applyEndTurn`'s half-end/GK-restart/generic-terminal returns), and `applyEndTurn`'s `throwInStillValid` re-entry guard is narrowed with a second independent signal. Tracing the full set of reachable "break in play" and pass-commit paths (including `gameHandlers.ts`'s synchronous `wasThrowIn` teardown at pass-commit time, which fires _before_ any subsequent interception/loose-ball/out-of-bounds resolution can occur) turned up no remaining leak of `throwInHex`/`throwInTeam`/`throwInPhasesTaken` into an unrelated Movement Phase.
- `ThrowInSetupPanel.tsx`'s waiting-state label now derives `actingSideLabel` from `throwInTeam === attackingTeam` instead of the dead `isMyThrow` ternary.
- `gameHandlers.ts`'s `GOAL_KICK_MOVE` branch now only rolls `kickDie` on the `OPP` slot.

This pass found one new, previously-unreported BLOCKER: `applyGoalKickReposition` (the new GOALKICK-02 6-hex-per-piece reposition-window function) and its `GAME_MOVE` handler branch omit the on-pitch bounds check that every sibling repositioning path in this same phase family enforces, allowing a piece to be walked off the 37×26 grid during a goal kick's reposition windows. One low-priority code-quality item (`GoalKickSetupPanel.tsx`'s inactive-window waiting label reads directly off `phase`/`activeTeam` rather than a derived acting-side label, unlike its `ThrowInSetupPanel` sibling that was just fixed for exactly this class of bug) is flagged as a WARNING. The pre-existing informational `resolveThrowInHex` last-resort-occupied-hex note from the prior review still applies unchanged and is restated here for completeness.

## Critical Issues

### CR-01: `applyGoalKickReposition` accepts an off-pitch destination hex, permanently corrupting the piece's position

**File:** `packages/server/src/gameEngine.ts:3452-3541` (`applyGoalKickReposition`), `packages/server/src/gameHandlers.ts:648-684` (the `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` `GAME_MOVE` branch)

**Issue:**

`applyGoalKickReposition` validates adjacency (`hexDistance(piece.position, to) !== 1`) and occupancy (`state.pieces.some(...)`) but never validates that `to` is actually a pitch hex. Its `GAME_MOVE` handler call site validates the payload _shape_ (`typeof to.q === 'number'`, etc.) but likewise never calls `isPitchHex(to)` before delegating:

```ts
// gameHandlers.ts:664-684
if (typeof to !== 'object' || to === null || typeof to.q !== 'number' || typeof to.r !== 'number') {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
  broadcastState(io, room);
  return;
}
const goalKickResult = applyGoalKickReposition(room.gameState, pieceId, to);
```

Every other server-side per-piece repositioning path added in or adjacent to this phase _does_ enforce this:

- `applyGoalKickTarget` (the sibling GOALKICK-05 target-selection function, ~30 lines below `applyGoalKickReposition` in the same file) explicitly checks `if (!isPitchHex(targetHex)) return { ok: false, reason: 'OFF_PITCH' };`.
- `validateResponseMoveStep` (used by the `GOAL_KICK_MOVE` travel window, the GOALKICK-05 sibling of this GOALKICK-02 window) checks `if (!PITCH_HEXES.some((h) => h.q === to.q && h.r === to.r)) return fail('OFF_PITCH');`.
- The client's own valid-hex computation for this exact window (`computeFreeMoveValidHexes`, `useGameStore.ts:406-419`, reused at `useGameStore.ts:725`) filters candidates through `PITCH_HEXES.some(...)` before ever offering them as clickable — so a compliant client can never trigger this, but a client emitting a raw `game:move` socket event with a hand-crafted `to` (e.g. `{ q: -1, r: <adjacent piece's r> }` or `{ q: 37, r: ... }`) is accepted at both layers.

Because the pitch is a full rectangle (`q ∈ [0,36], r ∈ [0,25]`, `packages/shared/src/pitch.ts:9-17`), any piece standing on a boundary column/row is one adjacent-hex click away from a coordinate outside that rectangle. A piece placed off-grid this way is never recoverable within the reposition window (each subsequent click is still just "adjacent to current position," so the piece can be walked arbitrarily far off-grid within its 6-hex budget) and stays there indefinitely — the piece's raw `q`/`r` continues to feed `isPastHalfway`/`isAheadOf`/`opposingPiecesEqualOrAhead` (`offside.ts`) and every subsequent `hexDistance`/`isInRegion` check for the rest of the match, silently corrupting offside evaluation, ZoI, and rendering (the piece disappears from the visible SVG grid, `HexGrid.tsx`, but is still counted by every geometry-based rule). No test in `goalKick.integration.test.ts` or `gameEngine.outOfBounds.test.ts` exercises an off-pitch `to` for `applyGoalKickReposition`/the `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` `GAME_MOVE` branch — contrast with the existing `'an off-pitch hex is rejected with OFF_PITCH'` test that covers `GAME_GOAL_KICK_TARGET` only (`goalKick.integration.test.ts:767`).

**Fix:** Add the same `isPitchHex`/`PITCH_HEXES` check both layers already use elsewhere:

```ts
// gameEngine.ts, applyGoalKickReposition — after the adjacency check, before occupancy:
if (!isPitchHex(to)) {
  return { ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' };
}
```

```ts
// gameHandlers.ts — inside the GOAL_KICK_SETUP_GK/GOAL_KICK_SETUP_OPPONENT branch,
// alongside the existing shape check:
if (!isPitchHex(to)) {
  socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
  broadcastState(io, room);
  return;
}
```

(`isPitchHex` is already imported in both files.) Add a regression test mirroring `goalKick.integration.test.ts:767` for the `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` reposition path.

## Warnings

### WR-01: `GoalKickSetupPanel`'s reposition-window waiting label does not use the same acting-side derivation `ThrowInSetupPanel` was just fixed to use

**File:** `packages/client/src/components/GoalKickSetupPanel.tsx:104-109`
**Issue:** The just-closed WR-01 finding from the prior review established that a waiting-state "which side is acting" label must be derived from state (`throwInTeam === attackingTeam`), not assumed from a fixed literal, because the acting side is not always "Attacking." `GoalKickSetupPanel`'s equivalent waiting branch for the `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` windows still hardcodes the assumption directly off `phase`:

```tsx
{phase === 'GOAL_KICK_SETUP_GK' ? 'Attacking' : 'Defending'} team is repositioning&hellip;
```

This happens to be correct today only because `triggerOutOfBoundsRestart`'s `GOAL_KICK` branch always sets `attackingTeam: goalKickTeam` at trigger time (mirroring the same invariant `ThrowInSetupPanel`'s fix comment calls out for throw-ins) and `applyGoalKickWindowEnd` never changes `attackingTeam` mid-window — so `phase === 'GOAL_KICK_SETUP_GK' ⟺ activeTeam === attackingTeam` holds today. But this is the exact "coincidentally true today, not defended by the type/derivation itself" pattern the prior review's WR-01 fix explicitly reasoned about and closed for the throw-in panel. A future change to the goal-kick trigger invariant (e.g. Phase 38 corner-kick reuse of this same panel shape, or a defending-team-initiated goal-kick variant) would silently break this label with no compiler or test signal, exactly as it did for `ThrowInSetupPanel` before 37-12.
**Fix:** Derive the label the same way `ThrowInSetupPanel.tsx` now does, from `activeTeam`/`goalKickTeam` rather than `phase`:

```tsx
const gkWindowActingLabel: 'Attacking' | 'Defending' =
  actingTeam === goalKickTeam ? 'Attacking' : 'Defending';
// ...
<span className={styles.constraintRow}>{gkWindowActingLabel} team is repositioning&hellip;</span>;
```

(`actingTeam` is already computed two lines above the branch this string lives in.)

## Info

### IN-01: `resolveThrowInHex`'s last-resort fallback can still return an occupied hex

**File:** `packages/shared/src/outOfBounds.ts:94-134`, consumed at `packages/server/src/gameEngine.ts:3235` and placed at `packages/server/src/gameEngine.ts:3367` (`applyThrowInPlace`)
**Issue:** Unchanged since the prior review. If no free, on-pitch hex exists within radius 6 of `preferred`, `resolveThrowInHex` returns `preferred` unchanged even if still occupied, and `applyThrowInPlace` unconditionally teleports the thrower onto it, which would place two pieces on the same hex. Given the pitch is 37×26 with only 22 pieces, this remains practically unreachable in the current 1v1, 22-piece game.
**Fix:** No action required for v1; if piece count or pitch size ever changes, consider widening the search radius or returning a null/error signal instead of a possibly-occupied hex.

---

_Reviewed: 2026-08-04T17:36:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
