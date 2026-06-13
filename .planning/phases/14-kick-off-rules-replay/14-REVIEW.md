---
phase: 14-kick-off-rules-replay
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - packages/server/src/__tests__/gameEngine.phase8.test.ts
  - packages/server/src/__tests__/kickoffSetup.integration.test.ts
  - packages/server/src/__tests__/replay.integration.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/shared/src/teams.ts
  - packages/shared/src/types.ts
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-06-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase delivers four features: MATCH-06 (4-5-2 home-squad starting positions), MATCH-07 (kick-off phase guard for standard-pass-only), REPLAY-06 (`ballAfter` on all replay-eligible events, driving per-frame ball state in `buildReplayFrames`), REPLAY-04/05 (500 ms frame cadence and simultaneous-step movement batching).

The implementation is largely correct, but three blockers were found:

1. `TACKLE_ATTEMPT` events are missing a `ballAfter` field both in the type definition and at every creation site — they are the only replay-eligible combat event that lacks it, causing `buildReplayFrames` to silently skip ball-position updates after tackles, producing wrong ball positions for all frames that follow a successful tackle.
2. `buildReplayFrames` applies `ballAfter` from **all** concurrent movers at each step-frame, not just the one that actually steps at that tick — when two pieces have unequal path lengths the ball position for frames beyond the shorter path is overwritten with a stale value from the shorter-path piece.
3. The `GAME_READY` handler in `kickoffSetup.integration.test.ts` / `gameHandlers.ts` finds the kicker by matching any piece at the kick-off hex, not specifically an attacking-team piece. If a defending piece is also on or adjacent to the kick-off hex the wrong team could be assigned possession.

Five warnings cover: a formation mismatch in `teams.ts` vs its own documentation, a missing `ballAfter` on `DEFLECT_ATTEMPT` events that are eligible for replay, an off-by-one in the defending-team half-boundary enforcement in `applyKickOffReady`, a stale `kickOffActive` flag path when `applyRoll` returns `FULL_TIME`, and a test that asserts `frames.length === 2` for two consecutive MOVEs of the same piece (which REPLAY-05 will batch into 1 frame, not 2).

---

## Critical Issues

### CR-01: `TACKLE_ATTEMPT` event missing `ballAfter` — replay ball position wrong after tackles

**File:** `packages/shared/src/types.ts:107-117`, `packages/server/src/gameEngine.ts:461-474`

**Issue:** The `TACKLE_ATTEMPT` member of the `ActionEvent` union has no `ballAfter` field. Every other combat event (`STEAL_ATTEMPT`, `GOAL`, `SHOT_ATTEMPT`, `KICK_OFF`, `STANDARD_PASS`, etc.) gained `ballAfter` as part of REPLAY-06. `TACKLE_ATTEMPT` was skipped. In `buildReplayFrames`, the universal ball-update path reads `if ('ballAfter' in event)` — so any frame triggered by a tackle (or any frame that follows a tackle in the same flush group) will carry stale ball coordinates. After a successful tackle the ball moves to the tackler's hex; this change will be invisible to the replay, causing all subsequent frames to show the ball at the wrong position.

Additionally, `TACKLE_ATTEMPT` is not in `REPLAY_ELIGIBLE_TYPES` (`gameEngine.ts:2828-2842`), so it never emits a frame. That means the tackle itself produces zero visual change in the replay — no snap of the ball — which is a separate but related quality gap.

**Fix:**

In `types.ts`, add `ballAfter` to `TACKLE_ATTEMPT`:

```typescript
| {
    type: 'TACKLE_ATTEMPT';
    defenderId: string;
    carrierId: string;
    defenderDie: number;
    carrierDie: number;
    defenderCombined: number;
    carrierCombined: number;
    result: 'SUCCESS' | 'FAIL';
    timestamp: number;
    ballAfter: { position: HexCoord; carrierId: string | null }; // ADD
  }
```

In `gameEngine.ts` around line 461, populate `ballAfter` when building the tackle event (SUCCESS: `{ position: to, carrierId: pieceId }`; FAIL: `{ position: state.ball.position, carrierId: state.ball.carrierId }`).

Add `'TACKLE_ATTEMPT'` to `REPLAY_ELIGIBLE_TYPES`.

---

### CR-02: `buildReplayFrames` — `ballAfter` overwrite logic wrong for unequal-length movement paths

**File:** `packages/server/src/gameEngine.ts:2916-2926`

**Issue:** In `flushMoveGroup`, the inner loop that chooses `stepBall` at each step `n` iterates over **all** pieces with accumulated moves:

```typescript
for (const [, path] of paths) {
  if (n <= path.length) {
    stepBall = path[n - 1]!.ballAfter;
  }
}
```

When two pieces have paths of length 3 and 1 respectively (exactly the REPLAY-05 test scenario), at step `n=2` the short-path piece has `n > path.length` (2 > 1) so its `ballAfter` is correctly skipped. But at step `n=1` **both** pieces satisfy `n <= path.length`, and whichever is last in iteration order wins. The map iteration order is insertion order, so the result depends on which piece was first added to `moveGroup`. If the ball-carrier's MOVE events are interleaved with a non-carrier's events in the event log the wrong `ballAfter` will be applied at step 1, silently overwriting the correct ball state.

More concretely: if `pieceY` moves first in the event log and `pieceX` moves second, `paths` is `[[pieceY, ...], [pieceX, ...]]`. At `n=1` the loop first writes `pieceY.path[0].ballAfter` then overwrites it with `pieceX.path[0].ballAfter`. The final value is always `pieceX`'s — regardless of which piece actually carries the ball. Any movement phase where the non-carrier moves last in the log will stamp the non-carrier's `ballAfter` onto the first step-frame.

**Fix:** Track only the _last_ `ballAfter` from a piece that **actually steps** at step `n` (i.e. `n === path.length` exactly, or if the ball-carrier moves, use that piece's `ballAfter`). The safest approach is to accumulate a `candidateBall` only from pieces whose current step index `n-1` falls within their path, and prefer the ball-carrier's entry:

```typescript
let stepBall = current.ball;
let ballUpdated = false;
for (const [pid, path] of paths) {
  if (n <= path.length) {
    const candidate = path[n - 1]!.ballAfter;
    // prefer ball-carrier's ballAfter; otherwise last writer wins
    if (!ballUpdated || candidate.carrierId !== null) {
      stepBall = candidate;
      ballUpdated = true;
    }
  }
}
```

A more robust approach: at each step only apply `ballAfter` from the single piece that actually changes the ball position (the carrier), determined by checking `path[n-1].ballAfter.carrierId`.

---

### CR-03: `GAME_READY` handler — kicker found by hex match, not by team — wrong carrier on overlap

**File:** `packages/server/src/gameHandlers.ts:1474-1483`

**Issue:** When both players have signalled ready, the handler finds the kicker with:

```typescript
const kicker = room.gameState.pieces.find(
  (p) => p.position.q === kickOffHex.q && p.position.r === kickOffHex.r,
);
```

`Array.find` returns the **first** piece at that hex. `pieces` is `[...HOME_SQUAD, ...AWAY_SQUAD]`, so home pieces appear before away pieces. `applyKickOffReady` only validates that the _attacking_ team has exactly one piece on the kick-off hex; it does not reject the case where a _defending_ piece is also present on that hex (the occupation guard is not applied to the defending team's centre-hex placement). If the defending team's piece happens to occupy the kick-off hex at validation time (which the current `OUT_OF_ZONE` guard would normally prevent but does not in the case where the defending team is `home` and the attacking team is `away` — see WR-02), the wrong piece could be assigned possession, inverting the attacking team.

Even without the overlap scenario, if `attackingTeam === 'away'` and home pieces appear first in the array, the find returns a home piece (wrong team). The real guard relies on the fact that `applyKickOffReady` ensures no defending piece is at the kick-off hex — but that guard runs _per team_, not for both teams simultaneously before the carrier assignment.

**Fix:** Filter by team before finding the kicker:

```typescript
const kicker = room.gameState.pieces.find(
  (p) =>
    p.teamId === room.gameState!.attackingTeam &&
    p.position.q === kickOffHex.q &&
    p.position.r === kickOffHex.r,
);
```

---

## Warnings

### WR-01: `teams.ts` formation documented as "4-5-2" but header comment says "3-2-4-1"

**File:** `packages/shared/src/teams.ts:6`

**Issue:** The file-level comment reads "Formation: 3-2-4-1 (3 DEF, 2 MID, 4 FWD, 1 ST)". The module is imported as `HOME_SQUAD`/`AWAY_SQUAD` everywhere under the label "4-5-2" (per MATCH-06, the task description, and `CLAUDE.md`). The actual piece counts in the squad match 3-2-4-1. This discrepancy means the "4-5-2" label used across the codebase (`applyHalfTimeStart` comment, test description "resets pieces to 4-5-2 default positions") describes the _movement sequence_ (`ATTACKER_4`, `DEFENDER_5`, `ATTACKER_2`) — not the formation. The comment on `teams.ts` is correct, but every caller-side comment that says "4-5-2 formation" is misleading. This can cause future developers to incorrectly alter the squad counts.

**Fix:** Add a single clarifying sentence at the top of `teams.ts` making clear that "4-5-2" refers to the movement sub-phase sequence (4 attackers, 5 defenders, 2 attackers), and that the actual player-position formation is 3-2-4-1. Audit all "4-5-2 formation" comments in `gameEngine.ts` and `gameHandlers.ts` and update to "3-2-4-1 formation".

---

### WR-02: `applyKickOffReady` OUT_OF_ZONE boundary is asymmetric for the defending team

**File:** `packages/server/src/gameEngine.ts:2726-2733`

**Issue:** For the attacking team, pieces may occupy up to and including `q=18` (home) or `q>=18` (away). For the defending team the limit is `kickOffHex.q - 1 = 17` (home) or `kickOffHex.q + 1 = 19` (away). This means a defending home piece at `q=18` is rejected with `OUT_OF_ZONE`. However, the `CENTRE_HEX_EMPTY` check only validates the _attacking_ team's piece, and the `IN_CENTRE_CIRCLE` check only fires for the defending team. A defending piece sitting at `q=18, r != 13` (on the kick-off column but not the kick-off hex) will be rejected by `OUT_OF_ZONE` (`q=18 > 17`) — which is correct — but the error message is `OUT_OF_ZONE` rather than a more specific reason.

More importantly, the `OUT_OF_ZONE` check does not consider the case where the defending team is `away` and places a piece at `q=18` exactly (the boundary). The limit for defending-away is `kickOffHex.q + 1 = 19`, so a defending-away piece at `q=18` passes `q >= 19` → `18 >= 19` is false → the piece is _rejected_. But this is wrong: a defending away piece should be allowed at `q=18` (the centre line) according to standard kick-off rules — only _the centre circle_ (radius 3) is restricted, not the entire home half. The `OUT_OF_ZONE` guard for the defending team is stricter than the centre-circle check it accompanies; the two rules should not overlap.

**Fix:** Remove the `OUT_OF_ZONE` guard for the defending team entirely if the intent is that only the `IN_CENTRE_CIRCLE` check applies to them. If halves apply to defenders too, document the intent precisely and add a test for a defending piece sitting exactly at `q=18`.

---

### WR-03: `DEFLECT_ATTEMPT` events in the event log have no `ballAfter` field but can precede replay frames

**File:** `packages/shared/src/types.ts:191-198`

**Issue:** `DEFLECT_ATTEMPT` has no `ballAfter` field. Unlike `TACKLE_ATTEMPT`, it is correctly absent from `REPLAY_ELIGIBLE_TYPES` so it never directly produces a frame. However, in `buildReplayFrames` a `DEFLECT_ATTEMPT` event causes `flushMoveGroup()` to be called (it is non-MOVE, non-SLOT_ADVANCE). After flushing, the universal `if ('ballAfter' in event)` does nothing (no field), so the ball position from the flushed movement phase remains unchanged. This is correct _by accident_ — if a `DEFLECT_ATTEMPT` appears mid-movement-group in the event log (e.g., a tackle-fail recorded during movement before a shot deflection), the movement flush is premature and the batched step-frame is split incorrectly.

The deeper issue is that `DEFLECT_ATTEMPT` is recorded _during_ the GAME_SHOT handler's deflection check loop, not inside an applyRoll call, so it appears in the event log interleaved with other events. If a movement phase ends and a shot immediately deflects, the `DEFLECT_ATTEMPT` events appear after the last `MOVE` events, which causes `flushMoveGroup` to fire at the right time. But if a deflection check is triggered during a phase where MOVE events can also appear, the log ordering breaks the REPLAY-05 batching assumption.

**Fix:** Add `ballAfter` to `DEFLECT_ATTEMPT` (using the ball position at the moment of deflection — the deflector's hex on `DEFLECTED`, otherwise the original carrier position). Alternatively, explicitly add `DEFLECT_ATTEMPT` to a skip-list in `buildReplayFrames` alongside `SLOT_ADVANCE` so it never triggers a premature flush.

---

### WR-04: `kickOffActive` not cleared when `applyRoll` produces `FULL_TIME`

**File:** `packages/server/src/gameHandlers.ts:1144-1148`

**Issue:** After `applyRoll` succeeds, the GAME_ROLL handler has this logic:

```typescript
if (room.gameState.kickOffActive) {
  room.gameState = { ...result.state, kickOffActive: false };
} else {
  room.gameState = result.state;
}
```

`applyRoll` can return `phase: 'FULL_TIME'` if the pass that clears `kickOffActive` also happens to be the last action of the second half (extremely rare but possible via e.g. added-time expiry triggered inside a nested call chain). In that scenario `result.state.phase === 'FULL_TIME'` but `room.gameState.kickOffActive` was `true` before the call, so the handler writes `{ ...result.state, kickOffActive: false }`. This is actually correct — the flag is cleared — but it also **skips** the `startReplayStream` call that follows (line 1150 is after the if/else, but the replay stream trigger is only called in `GAME_END_TURN`, not in `GAME_ROLL`). However a more subtle issue: `applyRoll` (`PASS` branch) never itself triggers `FULL_TIME`; the clock only increments at `ATTACKER_2 → null` in `applyEndTurn`. So this is dead code at present, but the guard is fragile and will fail silently if the FSM is ever extended.

More practically: `kickOffActive: false` is set in the spread, but `startReplayStream` is never called from `GAME_ROLL`. If `FULL_TIME` is ever reachable from a roll (e.g., via a future action that both resolves possession and expires the clock), the replay stream will never start for that game.

**Fix:** After the `if/else` block, add:

```typescript
if (room.gameState.phase === 'FULL_TIME') {
  startReplayStream(io, room);
}
```

mirroring the existing pattern in `GAME_END_TURN` and the `HIGH_PASS_MOVEMENT` branch.

---

### WR-05: `replay.integration.test.ts` test `D-33` expects `frames.length === 2` for 2 consecutive single-piece MOVE events, which REPLAY-05 collapses to 1 frame

**File:** `packages/server/src/__tests__/replay.integration.test.ts:229`

**Issue:** The test seeds two `MOVE` events for the **same** `piece.id` with consecutive positions, then asserts `expect(frames.length).toBe(2)`. Under REPLAY-05, all consecutive `MOVE` events accumulate in `moveGroup` per `pieceId`. Two moves for the same piece produce a path of length 2. At flush time, `K = 2` and two step-frames are emitted — so the assertion passes today. However the test comment says "2 MOVE events → 2 frames (D-32)" — the reasoning is wrong. The actual invariant under REPLAY-05 is "K step-frames where K = max path length across all pieces". If a future change adds a second piece that moves 3 steps in the same phase, the 2-piece flush would produce 3 frames, breaking the `toBe(2)` assertion with a confusing failure message.

The more serious variant: if both MOVE events were for _different_ pieces (as in the REPLAY-05 test at line 409), the assertion `expect(frames.length).toBe(2)` would hold only because `K = max(1, 1) = 1` yields 1 frame — but the test expects 2. The REPLAY-05 test at line 409 correctly expects 3 frames for 3+1 steps. The D-33 test is internally consistent only coincidentally.

**Fix:** Replace the frame-count assertion with a description of the actual invariant:

```typescript
// Under REPLAY-05: K = max path length = 2 (piece moved 2 steps)
expect(frames.length).toBe(2); // K = 2 steps for the single moving piece
```

Add a comment explaining the REPLAY-05 batching rule so future edits are not confused.

---

## Info

### IN-01: `DICE_PHASES` set in `gameHandlers.ts` does not include `'SHOT'` — dead code path

**File:** `packages/server/src/gameHandlers.ts:74`

**Issue:** `DICE_PHASES = new Set(['KICK_OFF', 'PASS', 'HEADER', 'LOOSE_BALL'])` is used as the phase guard in `GAME_ROLL`. The comment says "SHOT is handled by the separate game:gk-restart handler". But the `SHOT` phase itself was removed from the FSM and replaced by `GK_DIVING` + `SHOT` (the new two-step flow). `'SHOT'` still exists in `GamePhase` (types.ts) and in `applyRoll`'s switch. If the FSM ever enters `phase: 'SHOT'` (e.g., via a legacy path or test injection), `GAME_ROLL` would reject it with `WRONG_PHASE` rather than routing it to `applyRoll`. The stale comment ("GK_RESTART is handled by the separate game:gk-restart handler") refers to `GK_RESTART`, not `SHOT` — suggesting the comment was copy-pasted without update.

**Fix:** Either add `'SHOT'` to `DICE_PHASES` (if the `SHOT` phase can still be reached) or remove the `SHOT` case from `applyRoll`'s switch and `GamePhase` union if it is truly dead.

---

### IN-02: `applyHalfTimeStart` does not reset the ST positions for the second half

**File:** `packages/server/src/gameEngine.ts:2798`

**Issue:** `applyHalfTimeStart` resets pieces with `const resetPieces = [...HOME_SQUAD, ...AWAY_SQUAD]`. This uses the static squad arrays directly without running the ST-position override logic from `buildInitialGameState`/`buildKickOffPieces`. The `HOME_SQUAD` constant has `home-4` (ST) at `{q:18, r:13}` (the kick-off hex) and `AWAY_SQUAD` has `away-4` (ST) at `{q:22, r:13}`. After `applyHalfTimeStart`, the second half always starts with home-ST at the kick-off hex regardless of which team kicks off in the second half. This is inconsistent with `buildKickOffPieces` which correctly repositions ST based on `attackingTeam`.

**Fix:** Replace the static spread with a call to `buildKickOffPieces(newAttackingTeam)`:

```typescript
const resetPieces = buildKickOffPieces(newAttackingTeam);
```

This is the same helper used by `applyRoll` on goal. Remove the raw `[...HOME_SQUAD, ...AWAY_SQUAD]` spread.

---

### IN-03: `buildReplayFrames` — initial `current` state uses `KICK_OFF` phase but pieces are raw `HOME_SQUAD + AWAY_SQUAD` without ST override

**File:** `packages/server/src/gameEngine.ts:2874-2894`

**Issue:** The seeded `current` state uses `pieces: [...HOME_SQUAD, ...AWAY_SQUAD]` without the ST position override (same issue as IN-02 but in replay context). The first KICK_OFF event then sets `movementSlot: 'ATTACKER_4'` but does not reposition pieces. This means the replay's first frame shows the home ST at `{q:18, r:13}` regardless of the actual first-half kick-off team. For a game where `away` kicked off first, the replay shows the wrong starting position for the first frame.

**Fix:** Use `buildKickOffPieces(finalState.kickOffTeam)` instead of the raw spread:

```typescript
pieces: buildKickOffPieces(finalState.kickOffTeam),
```

---

### IN-04: TODO comment for `FIRST_TIME_PLAYER_MOVES` deferred work left in production path

**File:** `packages/server/src/gameEngine.ts:1112`

**Issue:** `// TODO: FIRST_TIME_PLAYER_MOVES (PASS-02) deferred to Phase 8.3` is in the hot path of `applyRoll`'s PASS branch. This is acceptable as a tracked deferred feature, but the TODO does not reference a tracking ticket or planning doc, making it easy to forget.

**Fix:** Link the TODO to the relevant planning document or acceptance criterion:

```typescript
// TODO: FIRST_TIME_PLAYER_MOVES (PASS-02) — deferred to Phase 8.3 (see ROADMAP.md / 08.3-PLAN.md)
```

---

_Reviewed: 2026-06-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
