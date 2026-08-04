---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
reviewed: 2026-08-04T00:00:00Z
depth: standard
files_reviewed: 37
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
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-08-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 37 (28 read in full; remaining files reviewed via targeted grep + section reads given file size)
**Status:** issues_found

## Summary

Reviewed the Phase 37 out-of-bounds/throw-in/goal-kick implementation across `packages/shared/src/outOfBounds.ts`, the corresponding `gameEngine.ts` state-machine additions (`triggerOutOfBoundsRestart`, `applyThrowInPlace`, the five `applyGoalKick*` functions, `applyUndo`'s new boundary/move-type branches), `gameHandlers.ts`'s new socket handlers, `roomHandlers.ts`'s settings-toggle validation, and the client-side `ThrowInSetupPanel`/`GoalKickSetupPanel`/`HexGrid` additions.

The geometry/classification layer (`outOfBounds.ts`) is well-factored, pure, and its test coverage is solid. The goal-kick state machine (five `applyGoalKick*` functions) is internally consistent — every terminal transition tears down its own tracking fields.

The throw-in state machine has a real, provable state-leak bug (CR-01, below): `throwInHex`/`throwInTeam`/`throwInPhasesTaken` are only cleared on the "clean" end-of-Movement-Phase path (`applyEndTurn`'s generic branch) and on a small explicit set of transitions (half-end, GK_RESTART entry, the pass-commit teardown). Any turnover that ends a Movement Phase _early_ — a successful tackle or steal, which return directly from `applyMove` without ever calling `applyEndTurn` — leaves those fields stale. Because `applyEndTurn`'s throw-in re-entry check keys off `carrier.teamId === state.throwInTeam` rather than an explicit phase/session marker, the stale fields can silently reactivate on a _later, unrelated_ Movement Phase once the ball happens to return to the original throw-in team, incorrectly restricting that team's next-action eligibility (and confusing the player with a "Throw-In!" prompt that has nothing to do with the actual game state).

## Critical Issues

### CR-01: Stale throw-in tracking state can resurrect and corrupt an unrelated Movement Phase's action eligibility

**File:** `packages/server/src/gameEngine.ts:3178-3215` (`triggerOutOfBoundsRestart`, THROW_IN branch), `packages/server/src/gameEngine.ts:915-972` (`applyMove` tackle-success return), `packages/server/src/gameEngine.ts:994-1045` (`applyMove` steal-success return), `packages/server/src/gameEngine.ts:1206-1237` (`applyEndTurn` throw-in re-entry check)

**Issue:**

`throwInHex`/`throwInTeam`/`throwInPhasesTaken` are set once by `triggerOutOfBoundsRestart`'s `THROW_IN` branch and are only explicitly cleared at four places:

1. `applyEndTurn`'s half-end return (line ~1157-1163)
2. `applyEndTurn`'s GK-carrier-in-own-penalty-area return (line ~1188-1195)
3. `applyEndTurn`'s **generic** "normal ATTACKER_2→PASS" return, via the `throwInClear` spread (line ~1242, ~1267) — this only runs when `applyEndTurn` is actually invoked
4. `gameHandlers.ts`'s `GAME_ROLL` PASS-commit branch, gated on `wasThrowIn = isThrowInContext(lastActionType)` at the moment the pass is committed (line ~1595-1606)

None of these fire when a Movement Phase ends _early_ via a successful tackle or steal — `applyMove`'s tackle-success return (`gameEngine.ts:915-972`) and steal-success return (`gameEngine.ts:994-1045`) both return directly with `phase: 'PASS'` (or a half-end phase) **without calling `applyEndTurn`**, and neither return touches `throwInHex`/`throwInTeam`/`throwInPhasesTaken`. `triggerOutOfBoundsRestart`'s GOAL_KICK branch (`gameEngine.ts:3217-3260`) has the same gap in the opposite direction — its `commonReset` object never touches the throw-in fields either.

Reachable sequence that corrupts state:

1. A sideline exit awards `home` a throw-in: `throwInTeam: 'home'`, `throwInPhasesTaken: 0`.
2. `home` places the thrower (`applyThrowInPlace`) and starts throw-in Movement Phase 1.
3. During the `DEFENDER_5` slot, `away` successfully tackles/steals the ball. `applyMove`'s steal/tackle-success branch returns directly (bypasses `applyEndTurn`) with `phase: 'PASS'`, `lastActionType: 'SUCCESSFUL_TACKLE'`, `attackingTeam: 'away'` — **`throwInPhasesTaken` is still `0` and `throwInTeam` is still `'home'`**.
4. `away` (now in `PASS` with `SUCCESSFUL_TACKLE` eligibility) chooses `MOVEMENT`, and during its own `DEFENDER_5` slot `home` tackles the ball back. Again this returns directly from `applyMove`, bypassing `applyEndTurn` a second time. Fields are still stale.
5. `home` chooses `MOVEMENT` again and this time completes a clean Movement Phase (no further turnover) all the way to the `ATTACKER_2`→`PASS` boundary. **This time `applyEndTurn` runs.** Its `throwInStillValid` check (`gameEngine.ts:1206-1211`) evaluates `state.throwInPhasesTaken !== null && < 2` (true, still `0`) `&& carrier.teamId === state.throwInTeam` (`home === home` — true, purely by coincidence of who currently holds the ball). The check fires, setting `lastActionType: 'THROW_IN_MOVEMENT_1'` and `throwInPhasesTaken: 1` on a Movement Phase that has nothing to do with a throw-in.

This is directly user-visible: `ActionPanel.tsx:752-761` renders `"Throw-In!"` / `"Take the throw now, or take another Movement Phase first."` and restricts the button set to `ELIGIBLE_NEXT_ACTIONS.THROW_IN_MOVEMENT_1` (`STANDARD_PASS`/`HIGH_PASS`/`MOVEMENT` only) — silently removing `SNAPSHOT`/`SHOT`/`LONG_BALL` that the team would otherwise be entitled to after a plain `MOVEMENT_PHASE`. If the same team completes one more clean Movement Phase while still in possession, the state can advance to `throwInPhasesTaken: 2` / `THROW_IN_MOVEMENT_2`, whose `ELIGIBLE_NEXT_ACTIONS` row (`actionSequence.ts:107-110`) deliberately omits `MOVEMENT` — i.e. the team is locked out of starting another Movement Phase entirely, forced into a pass they may not want, until that pass finally clears the stale fields via the `wasThrowIn` teardown in `gameHandlers.ts`.

This is not covered by any existing test — `throwIn.integration.test.ts` and `gameEngine.outOfBounds.test.ts` test the tackle/steal-clears-the-fields case only for a Movement Phase that _itself_ reaches `applyEndTurn` cleanly (see `gameEngine.outOfBounds.test.ts:610-627`, "does not fire when the carrier belongs to the opposing team"); there is no test for the early-return (tackle/steal-success) path, nor for the ball changing hands twice before the next `applyEndTurn` call.

**Fix:** Clear `throwInHex`/`throwInTeam`/`throwInPhasesTaken` (and, symmetrically, `goalKickTeam`/`goalKickGkId`/etc. in the reverse direction) on every "break in play" return, not just the ones that happen to route through `applyEndTurn`'s generic branch. Concretely:

```ts
// applyMove — tackle-success return (gameEngine.ts:947)
return {
  ok: true,
  state: {
    ...state,
    phase: tackleEndPhase ?? 'PASS',
    // ...existing fields...
    throwInHex: null,
    throwInTeam: null,
    throwInPhasesTaken: null,
  },
};

// applyMove — steal-success return (gameEngine.ts:1024)
return {
  ok: true,
  state: {
    ...state,
    phase: stealEndPhase ?? 'PASS',
    // ...existing fields...
    throwInHex: null,
    throwInTeam: null,
    throwInPhasesTaken: null,
  },
};
```

Alternatively (more robust, closes the class of bug instead of two instances of it): make `applyEndTurn`'s `throwInStillValid` re-entry check depend on an explicit "a throw-in Movement Phase is genuinely still in progress" flag that any turnover clears, rather than inferring it from `carrier.teamId === state.throwInTeam` — that inference is only valid if every turnover path is guaranteed to clear the throw-in fields, which is exactly the invariant currently violated.

## Warnings

### WR-01: Dead ternary in ThrowInSetupPanel always renders "Defending team is repositioning…"

**File:** `packages/client/src/components/ThrowInSetupPanel.tsx:42-53`
**Issue:** The waiting-state branch is only reached when `!isMyThrow` (line 45), i.e. `isMyThrow` is unconditionally `false` inside it. The message on line 50, `{isMyThrow ? 'Attacking' : 'Defending'} team is repositioning…`, therefore always evaluates to `'Defending'`, regardless of whether the team taking the throw-in is actually on the attack (e.g. a throw-in deep in the opponent's third). This is a copy-paste artifact from `GoalKickSetupPanel`'s equivalent message, where the ternary condition is `phase === 'GOAL_KICK_SETUP_GK'` — a value that genuinely varies independent of the viewer. There is no equivalent "which window" concept for a throw-in (only one team ever acts), so the condition should never have been `isMyThrow`.
**Fix:** Replace with a single, unconditional message — there is no "attacking vs defending" distinction to make here:

```tsx
<span className={styles.constraintRow}>Opponent is placing the thrower&hellip;</span>
```

### WR-02: `applyGoalKickMoveEnd` unconditionally rolls a die that is discarded on the KICKER slot

**File:** `packages/server/src/gameHandlers.ts:1010-1029`, `packages/server/src/gameEngine.ts:3827-3851`
**Issue:** The `GAME_END_TURN` handler calls `rollDice()` unconditionally before delegating to `applyGoalKickMoveEnd`, even on the `KICKER` slot where the engine explicitly ignores the value (documented at `gameEngine.ts:3804-3808`: "`kickDie` is deliberately ignored here"). This isn't a correctness bug (the doc comment acknowledges it and the discarded value has no gameplay effect), but it's an avoidable `crypto.randomInt` call on every goal kick and a slightly confusing signature (`applyGoalKickMoveEnd(state, kickDie)` always takes a die that half its call sites don't use). Low priority, flagged for maintainability.
**Fix:** Either have the handler only roll when `state.goalKickMoveSlot === 'OPP'`, or drop the `kickDie` parameter from the `KICKER`-slot code path entirely (e.g. split into two functions, or make it optional and roll internally on the `OPP` branch only — noting ARCH-01 forbids rolling inside the pure engine, so the cleanest fix is gating the handler's `rollDice()` call on the slot).

## Info

### IN-01: `resolveThrowInHex`'s last-resort fallback can return an occupied hex

**File:** `packages/shared/src/outOfBounds.ts:94-134`, consumed at `packages/server/src/gameEngine.ts:3190` and placed at `packages/server/src/gameEngine.ts:3322` (`applyThrowInPlace`)
**Issue:** If no free, on-pitch hex exists within radius 6 of `preferred` (documented as a defensive "last-resort fallback" in the JSDoc), `resolveThrowInHex` returns `preferred` unchanged even though it may still be occupied. `applyThrowInPlace` then unconditionally teleports the thrower onto that hex (`pieces: state.pieces.map((p) => (p.id === pieceId ? { ...p, position: throwInHex } : p))`), which would place two pieces on the same hex — a state no other part of the engine expects (ZoI/adjacency/click-to-move logic all assume unique occupancy). Given the pitch is 37×26 hexes with only 22 pieces on it, exhausting a full radius-6 disk (~127 hexes before the on-pitch/occupied filters) is extremely unlikely in practice, so this is informational rather than a practical risk in the current 1v1, 22-piece game.
**Fix:** No action required for v1 given the practical unreachability; if the piece count or pitch size ever changes, consider widening the search radius or returning `null`/an error signal instead of a possibly-occupied hex so the caller can react explicitly.

---

_Reviewed: 2026-08-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
