---
phase: 14-kick-off-rules-replay
fixed_at: 2026-06-12T21:07:00Z
review_path: .planning/phases/14-kick-off-rules-replay/14-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-06-12T21:07:00Z
**Source review:** .planning/phases/14-kick-off-rules-replay/14-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (3 critical, 5 warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: `TACKLE_ATTEMPT` event missing `ballAfter` — replay ball position wrong after tackles

**Files modified:** `packages/shared/src/types.ts`, `packages/server/src/gameEngine.ts`
**Commit:** 44d297e
**Applied fix:**

- Added `ballAfter: { position: HexCoord; carrierId: string | null }` field to `TACKLE_ATTEMPT` in the `ActionEvent` discriminated union (`types.ts`)
- Populated `ballAfter` at the creation site in `gameEngine.ts`: `SUCCESS` → `{ position: to, carrierId: pieceId }`, `FAIL` → `{ position: state.ball.position, carrierId: state.ball.carrierId }` (computed into `tackleBallAfter` before the event object is built)
- Added `'TACKLE_ATTEMPT'` to `REPLAY_ELIGIBLE_TYPES` so tackles emit replay frames

---

### CR-02: `buildReplayFrames` — `ballAfter` overwrite logic wrong for unequal-length movement paths

**Files modified:** `packages/server/src/gameEngine.ts`
**Commit:** 298b971
**Applied fix:** In `flushMoveGroup`, replaced the last-writer-wins loop with a `ballUpdated` flag approach. At each step `n`, pieces that satisfy `n <= path.length` are candidates. The ball-carrier's `ballAfter` (where `carrierId !== null`) is preferred; non-carrier updates are accepted only if no carrier update has been seen at that tick. This ensures the ball-carrier's position always wins, regardless of map insertion order.

---

### CR-03: `GAME_READY` handler — kicker found by hex match, not by team — wrong carrier on overlap

**Files modified:** `packages/server/src/gameHandlers.ts`
**Commit:** 654ce2d
**Applied fix:** Added `p.teamId === room.gameState!.attackingTeam &&` as the first predicate in the `pieces.find()` call. The kicker can now only be an attacking-team piece at the kick-off hex, preventing a defending piece that happens to be on that hex from being assigned possession.

---

### WR-01: `teams.ts` formation documented as "4-5-2" but header comment says "3-2-4-1"

**Files modified:** `packages/shared/src/teams.ts`, `packages/server/src/gameEngine.ts`, `packages/server/src/__tests__/gameEngine.phase8.test.ts`
**Commit:** 78f12ed
**Applied fix:**

- Added a clarifying note to `teams.ts`: "4-5-2" refers to the movement sub-phase sequence (4 attackers, 5 defenders, 2 attackers); the actual player-position formation is 3-2-4-1
- Updated `applyHalfTimeStart` doc comment and two inline comments in `gameEngine.ts` from "4-5-2 default/formation positions" to "3-2-4-1 formation starting positions"
- Updated the test description in `gameEngine.phase8.test.ts` to say "3-2-4-1 formation starting positions" with a parenthetical explaining 4-5-2 is the movement sequence

---

### WR-02: `applyKickOffReady` OUT_OF_ZONE boundary is asymmetric for the defending team

**Files modified:** `packages/server/src/gameEngine.ts`
**Commit:** ec06fa2
**Applied fix:** Restricted the `OUT_OF_ZONE` guard to attacking pieces only. Defending pieces have no half-boundary restriction at kick-off — they are only restricted from the centre circle (which the existing `IN_CENTRE_CIRCLE` check handles). The previous logic used `kickOffHex.q±1` for defenders, which incorrectly rejected defending-away pieces at q=18 (the centre line).

---

### WR-03: `DEFLECT_ATTEMPT` events in the event log have no `ballAfter` field but can precede replay frames

**Files modified:** `packages/server/src/gameEngine.ts`
**Commit:** 4a569cb
**Applied fix:** Added `DEFLECT_ATTEMPT` to the early-continue skip guard in `buildReplayFrames` alongside `SLOT_ADVANCE`. This prevents a `DEFLECT_ATTEMPT` event from triggering `flushMoveGroup()` prematurely when it appears mid-movement-group in the event log.

---

### WR-04: `kickOffActive` not cleared when `applyRoll` produces `FULL_TIME`

**Files modified:** `packages/server/src/gameHandlers.ts`
**Commit:** a3dbd54
**Applied fix:** Added a `if (room.gameState.phase === 'FULL_TIME') { startReplayStream(io, room); }` guard immediately after the `broadcastState` call in the `GAME_ROLL` handler. This mirrors the existing pattern in `GAME_END_TURN` and the `HIGH_PASS_MOVEMENT` branch, ensuring the replay stream starts if `applyRoll` ever transitions to `FULL_TIME` (currently unreachable but a forward-compatibility guard).

---

### WR-05: `replay.integration.test.ts` test `D-33` expects `frames.length === 2` with misleading comment

**Files modified:** `packages/server/src/__tests__/replay.integration.test.ts`
**Commit:** 9384144
**Applied fix:** Replaced the misleading "2 MOVE events → 2 frames (D-32)" comment with an accurate REPLAY-05 explanation: `K = max path length across all concurrently-moving pieces`. For a single piece moving 2 steps, K=2 and 2 step-frames are emitted — but a concurrent 3-step move would yield 3 frames. The assertion value is unchanged; only the explanatory comment was updated.

---

_Fixed: 2026-06-12T21:07:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
