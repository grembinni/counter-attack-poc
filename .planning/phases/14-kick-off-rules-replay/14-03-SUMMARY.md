---
plan: 14-03
phase: 14-kick-off-rules-replay
status: complete
completed: '2026-06-12'
requirements_addressed: [REPLAY-04, REPLAY-05]
key-files:
  modified:
    - packages/server/src/gameHandlers.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/replay.integration.test.ts
---

# Plan 14-03 Summary — 500ms Cadence + Simultaneous Step-Frames (REPLAY-04/REPLAY-05)

## What Was Built

**Task 1 — Halve replay interval to 500ms (REPLAY-04, commit 7c997e0):**
Changed `setInterval` delay in `startReplayStream` from `1000` to `500`. The
3000ms pre-roll `setTimeout` is unchanged. Only the one trailing delay argument
of the frame-emitting `setInterval` was modified.

**Task 2 — Simultaneous step-frame batching in buildReplayFrames (REPLAY-05, commit 7c997e0):**
Replaced the flat per-event loop in `buildReplayFrames` with a movement-phase
accumulator. Key changes:

- Added `moveGroup: Map<pieceId, MoveStep[]>` where `MoveStep = { to: HexCoord; ballAfter: ... }`.
- MOVE events are no longer emitted as individual frames. Instead they are pushed
  into `moveGroup` and processing continues.
- SLOT_ADVANCE events are still skipped without flushing (all slots in a movement
  phase batch together).
- When a non-MOVE, non-SLOT_ADVANCE event is encountered (or the log ends),
  `flushMoveGroup()` is called: it emits K step-frames (K = max path length
  across all accumulated pieces), where each frame repositions all accumulated
  pieces simultaneously. A piece with fewer than K steps holds its final hex for
  the remaining step-frames.
- Ball tracking per step-frame: for each step n, `stepBall` is updated from any
  piece that has an actual move at step n (not held at final hex). This preserves
  REPLAY-06 — a pickup MOVE's `carrierId` change appears at the correct step-frame.
- After the flush, final piece positions and `stepBall` are committed into
  `current` so subsequent non-MOVE events see the correct board state.
- Non-MOVE events continue to use the universal `if ('ballAfter' in event)`
  ball update from plan 14-02.

**Task 3 — Integration tests (commit af50052):**

Added two tests to `replay.integration.test.ts`:

- **REPLAY-04**: Fake-timer test simulating the startReplayStream timer pattern
  (3000ms setTimeout + 500ms setInterval). Asserts: no frame at t=3499ms;
  frame at t=3500ms; second frame at t=4000ms. Consistent with T-08-15 pattern.

- **REPLAY-05**: Pure `buildReplayFrames` test seeding pieceX (3 MOVE events)
  and pieceY (1 MOVE event). Asserts: exactly 3 step-frames (K=3); on step 1
  both pieces advance simultaneously; pieceY holds its final hex on steps 2 and 3
  while pieceX continues advancing.

## Verification

- `pnpm --filter @counter-attack/server typecheck` — 0 errors ✓
- `pnpm --filter @counter-attack/server test -- replay` — 8 tests pass ✓
- `pnpm --filter @counter-attack/server test -- phase8` — 61 tests pass ✓
- Node assertion: `}, 500);` present, `}, 1000);` absent in `startReplayStream` ✓

## Known Pre-Existing Failures

`kickoffSetup.integration.test.ts` and `game.integration.test.ts` continue to
exhibit intermittent failures (timing/race conditions). These predate Plan 14 and
are not caused by changes in this plan. Documented in 14-02-SUMMARY.md.

## Deviations

None. Implementation follows the plan spec exactly.

## Self-Check: PASSED
