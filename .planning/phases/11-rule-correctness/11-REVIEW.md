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
  critical: 2
  warning: 6
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

Phase 11 (rule-correctness) adds RULE-01 (high-pass accuracy ACK gate), RULE-02 (header duel winner replaces attacker-only guard on target selection), RULE-03 (stale `lastShotPath` cleared in LOOSE_BALL branches), and RULE-04/RULE-05 (client store guards for SNAP_DEFLECT pace exhaustion and post-deflect movement). The core engine logic for all four rules is sound. However two blockers exist: a testing-only pace override that was not removed before merge (`TESTING_PACE_OVERRIDE = 15`) will cause every piece in a real match to receive 15 hexes of pace, and a deadlock in the header tie path leaves the game in an unresolvable state with no recovery route. Several warnings around production console.log statements, missing broadcastState snap-backs, and a client-side accuracy message that always claims success round out the findings.

---

## Critical Issues

### CR-01: `TESTING_PACE_OVERRIDE` left active — all pieces get 15-hex pace in production

**File:** `packages/server/src/gameEngine.ts:50`
**Issue:** The constant `TESTING_PACE_OVERRIDE: number | null = 15` is set to a non-null value and is consumed unconditionally at line 306:

```ts
const rawPace = TESTING_PACE_OVERRIDE ?? piece.pace;
```

The comment on line 49 says "TESTING ONLY — set to null to use real piece pace values. Remove before ship." It was never removed or set to null. Every piece in a live match receives 15 hexes of pace regardless of their `PlayerPiece.pace` attribute. This completely breaks movement balance, makes pace-dependent features (ZoI, ATTACKER_2 cap, exhaustion tracking) behave incorrectly, and violates ARCH-01 server-authoritative semantics.

**Fix:**

```ts
// Remove the constant entirely, or set to null:
const TESTING_PACE_OVERRIDE: number | null = null;
```

Then delete the comment; the override is unnecessary when `null`.

---

### CR-02: Header tie deadlock — `headerDuelWinner: null` leaves game stuck in HEADER phase forever

**File:** `packages/server/src/gameHandlers.ts:1963`
**Issue:** When `computeHeaderDuelWinner` returns `null` (a tie), `headerDuelWinner` is stored as `null` on the game state. The comment acknowledges this: "For tie: neither team can submit GAME_HEADER_TARGET — the UI should handle this." But the UI has no handler for this state. Neither client receives a path to continue:

1. `GAME_HEADER_TARGET` is blocked because `duelWinner` is null → `WRONG_TEAM` for both sockets (line 1870).
2. `GAME_ROLL` in HEADER phase is blocked because `bothConfirmed` is already true and the handler's internal HEADER check gates on both-confirmed before the duel fires (line 1111), but `DICE_PHASES` only covers `HEADER` — however once both teams confirm, the only remaining action is `GAME_HEADER_TARGET`. The original `GAME_ROLL` HEADER path also requires `headerConfirmed.home && headerConfirmed.away` (line 1111) and would proceed, but `RULE-02` replaced the duel-fire from `GAME_ROLL` to `GAME_HEADER_CONTESTANT`. Now `GAME_ROLL` in HEADER phase triggers `applyRoll` HEADER branch which requires both teams to be confirmed AND `headerDuelWinner` is never checked — it would re-fire the duel from scratch (the dice are not the stored winner dice, so this is incorrect anyway).
3. There is no `END_TURN` handler for HEADER phase.

The net result: on a tie, the game is permanently stuck in HEADER phase with no escape. No test covers this recovery path. The tie case needs an explicit server-side resolution (e.g., transition to LOOSE_BALL immediately when `winner === null` inside the `bothConfirmed` block in `GAME_HEADER_CONTESTANT`).

**Fix:** In `gameHandlers.ts` inside the `bothConfirmed` block (around line 1954), check for a null winner and immediately resolve to LOOSE_BALL:

```ts
if (bothConfirmed) {
  // ... compute diceArr and winner as today ...
  const winner = computeHeaderDuelWinner(room.gameState, diceArr);

  if (winner === null) {
    // Tie → LOOSE_BALL immediately; clear all header fields
    room.gameState = {
      ...room.gameState,
      phase: 'LOOSE_BALL',
      ball: { position: room.gameState.ball.position, carrierId: null },
      lastActionType: 'DEFLECTION',
      headerContestants: null,
      headerConfirmed: null,
      headerTargetHex: null,
      headerAccuracyRollPending: null,
      headerDuelWinner: null,
    };
  } else {
    room.gameState = { ...room.gameState, headerDuelWinner: winner };
  }
}
```

---

## Warnings

### WR-01: `ActionPanel.tsx` accuracy-roll acknowledgment message always shows "pass is accurate!"

**File:** `packages/client/src/components/ActionPanel.tsx:193`
**Issue:** The HEADER phase accuracy-roll acknowledgment panel (lines 192–210) always displays the string "pass is accurate!" regardless of the roll value:

```tsx
<span className={styles.phaseLabel}>
  High Pass accuracy roll: {rollValue} — pass is accurate! Click to continue.
</span>
```

`headerAccuracyRollPending` is only set to `true` in `applyRoll` when the high-pass accuracy check **succeeds** (line 1083 of `gameEngine.ts`). When it fails, the state transitions to `LOOSE_BALL` immediately without setting the flag. So the message is technically always correct — but only by coincidence of the current FSM. It is misleading because it hardcodes the outcome text rather than deriving it from state, and it will silently show a false message if the flow ever changes. There is also no acknowledgment UI shown to the non-attacker: the defender sees "waiting for attacker" with no indication of the roll result.

**Fix:** The accuracy context is available via `lastDiceRoll.context === 'PASS_ACCURACY'`. Derive the label:

```tsx
<span className={styles.phaseLabel}>
  High Pass accuracy roll: {rollValue} — accurate! Click to continue.
</span>
```

Remove the hardcoded "pass is accurate!" and optionally show the roll threshold to the player (pass threshold is `highPass >= 3` per `validatePassAccuracy`).

---

### WR-02: `GAME_SNAPSHOT` null-state handler missing snap-back on early return

**File:** `packages/server/src/gameHandlers.ts:1662`
**Issue:** The null-state guard at line 1662–1666 in `GAME_SNAPSHOT` does not call `broadcastState`:

```ts
if (room.gameState === null) {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
  return; // <-- no broadcastState here
}
```

Every other null-state guard in the file includes `broadcastState(io, room)` on the error path (e.g., `GAME_GK_DIVE` at line 1704–1708, `GAME_MOVE` at line 269–274). The snap-back pattern (ARCH-04) is required on all rejection paths so the client re-syncs. This inconsistency was missed — the same gap exists in the `GAME_SNAPSHOT` handler only.

**Fix:**

```ts
if (room.gameState === null) {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
  broadcastState(io, room); // snap-back — ARCH-04
  return;
}
```

---

### WR-03: Multiple production `console.log` calls in shot/deflection hot paths

**File:** `packages/server/src/gameHandlers.ts:746,756,783,833,1261,1271,1298,1750,1769`
**Issue:** Nine `console.log` calls remain in the production `gameHandlers.ts` hot paths: deflection check summaries, GK_DIVING outcome logs, SNAP_DEFLECT range checks, and GAME_SHOT deflection results. These are production server logs that will write to stdout on every shot in every live game, polluting CloudWatch log streams with verbose game debugging output. They also leak game state information (piece IDs, dice values) in a way that could be observed by hosting operators.

**Fix:** Remove all `console.log` statements from `gameHandlers.ts` before deployment. If logging is needed, use a structured logger with configurable log level gated on `NODE_ENV !== 'production'`.

---

### WR-04: `applyResolveHeaderTarget` uses original `state.attackingTeam` for goal-line routing even when defender wins

**File:** `packages/server/src/gameEngine.ts:2322`
**Issue:** In `applyResolveHeaderTarget`, the goal-line routing logic reads:

```ts
const attackingTeamForHeader = state.attackingTeam;
const goalQ = attackingTeamForHeader === 'home' ? 36 : 0;
const isGoalLineTarget = targetHex.q === goalQ && targetHex.r >= 10 && targetHex.r <= 16;
```

When the defender wins the duel (`headerDuelWinner` is the defending team), `state.attackingTeam` still refers to the original attacker. The defender is heading toward their attacking direction — which is the opposite goal. So `goalQ` will point at the **wrong** goal for a defender-win scenario. For example, if home was attacking (`attackingTeam='home'`) and away wins the header, `goalQ` is 36 (home's attacking goal), but the away winner would head toward their own attacking goal at `q=0`. The result: a defender win heading toward q=0 would never be routed to `GK_DIVING`, even if it is a goal-line header.

However, looking at `GAME_HEADER_TARGET` handler (line 1870): `socketTeam(socket) !== duelWinner` — only the winner can submit. So if away won, the away socket submits. The away socket attacking direction is `q=0`. But `goalQ` is computed as 36. The `isGoalLineTarget` check would fail for `q=0`, routing to PASS instead of GK_DIVING — a missed headed-at-goal opportunity for the winning defender.

**Fix:**

```ts
// Use winner's team to determine their attacking direction
const attackingTeamForHeader = state.headerDuelWinner ?? state.attackingTeam;
const goalQ = attackingTeamForHeader === 'home' ? 36 : 0;
```

---

### WR-05: `computeHeaderDuelWinner` duplicates the full duel logic from `applyRoll` HEADER branch without sharing it

**File:** `packages/server/src/gameEngine.ts:2182`
**Issue:** `computeHeaderDuelWinner` (lines 2182–2243) contains a complete copy of the contestant-result building, tiebreak, and scoring logic from the `applyRoll` HEADER branch (lines 1382–1414). The two implementations differ subtly:

- `applyRoll` HEADER: uses `piece.heading + die` for raw score (line 1390)
- `computeHeaderDuelWinner`: uses `computeCombinedScore(piece.heading, die, [])` (line 2203)

`computeCombinedScore` applies penalty modifiers (though the empty array `[]` means no penalty here), and may clamp or handle edge cases differently than plain addition. If `computeCombinedScore` ever applies a floor/ceil or handles negative values differently, the two functions will produce different rankings for the same dice — causing `applyRoll` and `computeHeaderDuelWinner` to disagree on who won a particular duel. This is currently latent but fragile.

**Fix:** Extract the shared duel logic into a single internal helper used by both `applyRoll` HEADER case and `computeHeaderDuelWinner`, or make `applyRoll`'s raw score calculation also call `computeCombinedScore`.

---

### WR-06: `GK_KICK_MOVEMENT` OPP-slot end-turn does not auto-emit `LOOSE_BALL` scatter but instead enters `LOOSE_BALL` phase without rolling dice

**File:** `packages/server/src/gameHandlers.ts:653`
**Issue:** When a GK kick is inaccurate, the handler at line 653 sets `phase: 'LOOSE_BALL'` and `lastActionType: 'DEFLECTION'` — but does NOT immediately roll the scatter dice. `LOOSE_BALL` requires `GAME_ROLL` from the active player to resolve. This means after an inaccurate GK kick, both clients are left waiting for the active player to manually click Roll — yet there is no UI prompt for this because `ActionPanel.tsx` has no explicit handler for `LOOSE_BALL` phase outside of the `useEffect` auto-roll at line 74:

```ts
useEffect(() => {
  if (phase === 'LOOSE_BALL' && isActivePlayer) {
    emitRoll();
  }
}, [phase, isActivePlayer, emitRoll]);
```

This auto-roll effect will fire, so in practice the client auto-resolves. However the effect dependency array does not include `roomCode` or any identifier, so if the same client is reassigned during reconnect or the effect fires before socket is ready, the roll may be emitted when the connection is not valid. This is a marginal risk but the inconsistency between "GK_DIVING → shot auto-resolves without end-turn" (no user action needed) and "inaccurate GK kick → LOOSE_BALL → client auto-roll effect" (implicit, not documented) is a quality concern.

The deeper issue is that the inaccurate kick transition at line 653 is missing `lastShotPath: null` in its state spread — the prior value of `lastShotPath` (if any) is inherited via `...gkEndState`. This means a stale shot path from a prior shot could persist on screen after an inaccurate GK kick.

**Fix:** Add `lastShotPath: null` to the inaccurate-kick branch:

```ts
room.gameState = {
  ...gkEndState,
  phase: 'LOOSE_BALL',
  ball: { position: targetHex, carrierId: null },
  ...
  lastShotPath: null,   // <-- add this
  ...
};
```

---

## Info

### IN-01: `useGameStore.ts` still imports `mockMovementState` as initial store state

**File:** `packages/client/src/store/useGameStore.ts:15`
**Issue:** The production store initialises with `mockMovementState` (line 15 import, line 164 usage). Mock state is appropriate for development and test isolation but should not be the live default in production bundles. Any connected client will briefly render a fake game board before the server's first `GAME_STATE` broadcast arrives.

**Fix:** Use a minimal idle/lobby sentinel as the initial state, or only initialise with mock state behind a `process.env.NODE_ENV === 'development'` guard.

---

### IN-02: `gameEngine.rule11.test.ts` distance-7 boundary test is vacuously passing

**File:** `packages/server/src/__tests__/gameEngine.rule11.test.ts:318`
**Issue:** The test "accepts a hex exactly at distance 6 from winner position" contains a conditional that makes the distance-7 assertion unreachable:

```ts
if (result7.ok) {
  // If it passes, the range is > 6 which would be a bug — but only if we're within board
  // For this test, just assert distance-7 result is inconsistent with distance-6
  expect(result7.ok).toBe(false);
}
```

If `result7.ok` is `true`, the inner `expect(result7.ok).toBe(false)` will fail — but only then. If `result7.ok` is `false` (the expected case), the inner `expect` is never reached and Vitest counts this as a pass regardless of `result7`. The intent is to assert that distance-7 fails, but the conditional wrapping makes it a no-op assertion. The test should be:

```ts
expect(result7.ok).toBe(false);
if (!result7.ok) expect(result7.reason).toBe('INVALID_TARGET');
```

---

### IN-03: `GAME_HEADER_ACCURACY_ACK` handler comment says "Pitfall 2" but should say "Pitfall 5"

**File:** `packages/server/src/gameHandlers.ts:1815`
**Issue:** The `finally` block comment on line 1815 reads `// MUST be in finally — Pitfall 2`. The correct reference is Pitfall 5 (isProcessing released in finally — never conditionally). Pitfall 2 is the "never read socket.rooms" anti-pattern. All other handlers in the file correctly say "Pitfall 5". The same incorrect comment appears at line 1975.

**Fix:** Change both instances to `// MUST be in finally — Pitfall 5`.

---

_Reviewed: 2026-06-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
