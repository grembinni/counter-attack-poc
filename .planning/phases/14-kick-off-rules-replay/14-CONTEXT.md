# Phase 14: Kick Off Rules & Replay - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce kick off placement defaults and opening-pass constraint; overhaul replay speed and movement animation fidelity. All changes are server-side game logic (gameEngine.ts, gameHandlers.ts), shared types (ActionEvent schema), and the replay stream emitter.

**Requirements in scope:** MATCH-06, MATCH-07, REPLAY-04, REPLAY-05, REPLAY-06

</domain>

<decisions>
## Implementation Decisions

### Kick Off Rules

- **D-01 (MATCH-06):** The cols 6–20 constraint is a _default start position_ requirement only — not a movement restriction during KICK_OFF_SETUP. Players can freely reposition their pieces anywhere on-pitch during setup. The enforcement is: `buildInitialGameState` and the half-time reset must place midfielders and backs within `q ∈ [6, 20]`. No new rejection logic is needed in `GAME_KICK_OFF_MOVE` or `applyKickOffReady`. Verify the existing hardcoded squad positions satisfy this; adjust initial positions if any midfielder/back starts outside that range.

  > **Note for researcher/planner:** REQUIREMENTS.md success criteria #1 ("placing a midfielder or back outside hex columns 6–20 is rejected by the server") does not match the intended behaviour. The requirement is about initial placement, not a live movement guard. Update REQUIREMENTS.md when implementing.

- **D-02 (MATCH-07):** Add a guard in the `GAME_ROLL` handler (`gameHandlers.ts:976`) for the direct KICK_OFF phase path: when `room.gameState.phase === 'KICK_OFF'` and `passType !== 'STANDARD_PASS'`, emit `GAME_ERROR` with a suitable error code (e.g., `'KICKOFF_STANDARD_PASS_ONLY'`) and snap back. The `kickOffActive` flag (used during MOVEMENT) already ensures movement-first kick off context; no additional guard is needed on that path.

### Replay Speed

- **D-03 (REPLAY-04):** Change the `setInterval` delay in `startReplayStream` (`gameHandlers.ts:188`) from `1000` to `500` milliseconds. One-line change.

### Replay Movement Animation

- **D-04 (REPLAY-05):** Step-by-step simultaneous movement replay. `buildReplayFrames` must:
  1. Detect movement phase boundaries using existing event types: a SLOT_ADVANCE event or any non-MOVE event (STANDARD_PASS, HIGH_PASS, GOAL, KICK_OFF, etc.) marks the end of a movement phase.
  2. Within each boundary-delimited group, build a per-piece path by collecting consecutive MOVE events for the same pieceId.
  3. Emit K frames where K = max path length across all pieces in the group. Frame n (1-indexed) shows each piece at step n (or its last position if the piece has fewer steps). No new event schema needed — SLOT_ADVANCE and non-MOVE events serve as natural boundaries.

- **D-05 (REPLAY-05):** SLOT_ADVANCE events are already skipped in `buildReplayFrames` (line 2856). The batching logic lives between the existing "skip SLOT_ADVANCE" block and the current MOVE handler — restructure that section rather than adding a new pass.

### Ball Tracking in Replay

- **D-06 (REPLAY-06):** Add a required `ballAfter: { position: HexCoord; carrierId: string | null }` field to every replay-eligible `ActionEvent` union member in `packages/shared/src/types.ts`. Required (not optional) to prevent silent gaps — TypeScript enforces all event-creation sites.

  Replay-eligible ActionEvent types that need `ballAfter`:
  - `MOVE` (ball doesn't move on a piece move, but carrierId may change if a piece picks up a loose ball)
  - `STANDARD_PASS`, `FIRST_TIME_PASS`, `HIGH_PASS`, `LONG_BALL`
  - `SHOT_ATTEMPT` (all three outcomes: GOAL, SAVE, LOOSE_BALL — scatter hex captured here)
  - `SNAPSHOT`
  - `GOAL` (ball returns to kickOffHex after scoring — already emits a frame)
  - `KICK_OFF`
  - `DEFLECT_ATTEMPT`
  - `STEAL_ATTEMPT`, `DICE_ROLL`, `HALF_TIME`, `FULL_TIME` (if replay-eligible)

  In `buildReplayFrames`, after applying any board mutation, update `current.ball = event.ballAfter` for every event that carries it. This supersedes the existing GOAL-only ball update logic.

  > **Note for researcher/planner:** Check `REPLAY_ELIGIBLE_TYPES` set in gameEngine.ts to confirm the exact set of events that need `ballAfter`. All event-creation call sites in gameEngine.ts must be updated to include the ball state at the moment the event is appended to eventLog.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — MATCH-06 (note: success criteria 1 needs correction per D-01), MATCH-07, REPLAY-04, REPLAY-05, REPLAY-06

### Server Implementation

- `packages/server/src/gameHandlers.ts` — `GAME_ROLL` handler (line ~950, MATCH-07 guard goes here); `startReplayStream` (line ~159, REPLAY-04 delay change here); `GAME_KICK_OFF_MOVE` handler (line ~1349, verify no changes needed per D-01)
- `packages/server/src/gameEngine.ts` — `buildReplayFrames` (line ~2824, REPLAY-05 and REPLAY-06 restructure here); `buildInitialGameState` (verify midfielder/back starting positions for MATCH-06); `REPLAY_ELIGIBLE_TYPES` set (controls which events emit frames)

### Shared Types

- `packages/shared/src/types.ts` — `ActionEvent` union (line ~80, add `ballAfter` to all replay-eligible members per D-06)

### Test Files

- `packages/server/src/__tests__/kickoffSetup.integration.test.ts` — existing kick off setup tests; extend for MATCH-07 guard
- `packages/server/src/__tests__/replay.integration.test.ts` — existing replay tests; extend for REPLAY-04/05/06

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `kickOffActive: boolean` on GameState — already tracks kick off context for MOVEMENT path; MATCH-07 only needs a parallel guard on the direct KICK_OFF phase path
- `REPLAY_ELIGIBLE_TYPES` set in gameEngine.ts — authoritative filter for which events produce replay frames; use this to determine the full `ballAfter` migration scope
- `broadcastState` + snap-back pattern — already established for all GAME_KICK_OFF_MOVE and GAME_ROLL rejections; MATCH-07 guard follows the same pattern

### Established Patterns

- All GAME_ROLL rejections: `socket.emit(ServerEvents.GAME_ERROR, 'ERROR_CODE')` → `broadcastState` → `return` inside `isProcessing` try/finally block
- Event creation pattern: `{ type: 'EVENT_TYPE', ...fields, timestamp: Date.now() }` appended to `state.eventLog` — add `ballAfter` to every such object when migrating

### Integration Points

- All event-creation call sites in `gameEngine.ts` must pass `ballAfter` when constructing ActionEvents. TypeScript will surface every missing site as a compile error once the type is updated — use this as the migration guide.
- `buildReplayFrames` needs restructuring: current flat MOVE handler becomes a phase-boundary accumulator loop (D-04)
- `startReplayStream` in gameHandlers.ts emits the frames — only the delay changes (D-03)

</code_context>

<specifics>
## Specific Ideas

- REPLAY-05 frames per movement phase: K = max number of steps taken by any single piece in that phase. Pieces with fewer steps stay at their last position for the remaining frames. This produces smooth "they stop when they're done" animation.
- REPLAY-05 phase boundary detection: iterate the eventLog linearly; when a non-MOVE, non-SLOT_ADVANCE event is encountered, flush the accumulated MOVE group as K step-frames before emitting the non-MOVE frame.
- REPLAY-06 `ballAfter` migration: updating the TypeScript type is the safest migration path — the compiler will enumerate every event-creation site that needs updating.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 14-kick-off-rules-replay_
_Context gathered: 2026-06-12_
