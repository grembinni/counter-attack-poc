---
phase: 38-corner-kick
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - packages/client/src/components/ActionLog.test.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/BallLocationRing.test.tsx
  - packages/client/src/components/BallLocationRing.tsx
  - packages/client/src/components/CornerKickSetupPanel.module.css
  - packages/client/src/components/CornerKickSetupPanel.test.tsx
  - packages/client/src/components/CornerKickSetupPanel.tsx
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/server/src/__tests__/cornerKick.integration.test.ts
  - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
  - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts
  - packages/server/src/__tests__/gameHandlers.cornerKick.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/shared/src/actionSequence.test.ts
  - packages/shared/src/actionSequence.ts
  - packages/shared/src/events.ts
  - packages/shared/src/offside.ts
  - packages/shared/src/outOfBounds.test.ts
  - packages/shared/src/outOfBounds.ts
  - packages/shared/src/types.ts
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-08-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Phase 38 (Corner Kick) is a large, carefully-documented extension of the restart-flow
architecture established in Phase 37 (Goal Kick / Throw-In). The vast majority of the new
code — trigger classification, the two GK reposition windows, corner-taker selection, the
6-stage `CORNER_KICK_REPOSITION` window, the pre-kick `CORNER_KICK_FINAL_SETUP` window, and
the High/Low accuracy resolution wired into `applyRoll`'s `PASS` case — is internally
consistent, well-guarded server-side (phase guards, acting-team derivation from persistent
`cornerKickTeam` rather than mutable `activeTeam`, ASVS-style payload shape checks), and
mirrors its Goal Kick/Free Kick precedents closely.

However, `applyUndo` (`gameEngine.ts`) was **not** correctly extended for the two new
`CORNER_KICK_*` move-bearing phases, even though both were added to `gameHandlers.ts`'s
`validUndoPhases` allow-list. This produces two distinct, independently reachable bugs in
live gameplay (not just theoretical): Undo is completely broken in `CORNER_KICK_FINAL_SETUP`,
and Undo silently corrupts per-piece pace-budget bookkeeping in `CORNER_KICK_REPOSITION`. The
existing test suite has an `it('CORNER_KICK_FINAL_SETUP accepts Undo after a move', ...)` test
that exercises exactly this path but only asserts `state.phase`, not that the move was actually
reversed or that no `GAME_ERROR` was emitted — so it passes despite the underlying feature being
broken, and this masked the defect. A secondary issue was found in `buildReplayFrames`, where
two of the five corner-kick event types never update the reconstructed piece list, leaving
stale piece positions in the end-of-match replay stream after any corner-kick GK placement or
final-setup reposition.

## Critical Issues

### CR-01: `applyUndo` cannot find the move to undo in `CORNER_KICK_FINAL_SETUP` — Undo is completely broken

**File:** `packages/server/src/gameEngine.ts:1662-1675` (`moveTypeForPhase` in `applyUndo`)
**Issue:**
`applyCornerKickFinalMove` (gameEngine.ts:4109-4116) appends an event of type
`'CORNER_KICK_MOVE'` when a piece is repositioned during `CORNER_KICK_FINAL_SETUP`. But
`applyUndo`'s `moveTypeForPhase` ternary chain has no case for `CORNER_KICK_FINAL_SETUP` (it
covers `HIGH_PASS_MOVE`, `FIRST_TIME_PASS_MOVE`, `GK_KICK_MOVE`, `SNAPSHOT_DEFLECT`,
`FREE_KICK_SETUP`, `GOAL_KICK_MOVE`, then defaults to `'MOVE'`). Since `CORNER_KICK_FINAL_SETUP`
falls through to the `'MOVE'` default, `applyUndo` searches the current slot's events for a
`'MOVE'`-typed event — which never exists in this phase — so `lastMoveRelIdx` is always `-1`
and the function returns `{ ok: false, reason: 'NOTHING_TO_UNDO' }` (or `UNDO_LOCKED`, depending
on unrelated prior `'MOVE'` events earlier in the log) even immediately after a real,
just-completed `CORNER_KICK_MOVE`.

Net effect: pressing Undo during `CORNER_KICK_FINAL_SETUP` (CORNER-06's 1-player-per-team
pre-kick reposition window) never reverts the piece and always surfaces a `GAME_ERROR` to the
client — Undo is a complete no-op in this phase, despite `CORNER_KICK_FINAL_SETUP` being
explicitly listed in `gameHandlers.ts`'s `validUndoPhases` (line 1571) as a phase where Undo
is supposed to work.

This is masked by `gameHandlers.cornerKick.test.ts`'s
`'CORNER_KICK_FINAL_SETUP accepts Undo after a move'` test (line 978), which only asserts
`state.phase === 'CORNER_KICK_FINAL_SETUP'` on the `GAME_STATE` broadcast that follows Undo.
Since the handler broadcasts the (unchanged) `GAME_STATE` on failure too
(`gameHandlers.ts:1606-1613`), the phase assertion trivially holds whether Undo succeeded or
failed — the test never checks the piece's position or that no `GAME_ERROR` was emitted, so it
passes even though the feature is completely broken.

**Fix:**
Add an explicit `CORNER_KICK_FINAL_SETUP` case to `moveTypeForPhase`, and extend the `lockReset`
ternary (gameEngine.ts:1762-1829) the same way `GOAL_KICK_MOVE` is handled, to correctly
decrement `cornerKickPaceUsed` / clear `cornerKickMovedPieceId`:

```ts
const moveTypeForPhase =
  state.phase === 'HIGH_PASS_MOVE'
    ? 'HP_MOVE'
    : state.phase === 'FIRST_TIME_PASS_MOVE'
      ? 'FTP_MOVE'
      : state.phase === 'GK_KICK_MOVE'
        ? 'GK_KICK_MOVE'
        : state.phase === 'SNAPSHOT_DEFLECT'
          ? 'SNAP_DEFLECT_MOVE'
          : state.phase === 'FREE_KICK_SETUP'
            ? 'FK_SETUP_MOVE'
            : state.phase === 'GOAL_KICK_MOVE'
              ? 'GOAL_KICK_MOVE'
              : state.phase === 'CORNER_KICK_FINAL_SETUP' // <-- add this case
                ? 'CORNER_KICK_MOVE'
                : 'MOVE';
```

and in `lockReset`, add a branch mirroring the existing `GOAL_KICK_MOVE` branch:

```ts
: state.phase === 'CORNER_KICK_FINAL_SETUP'
  ? (() => {
      const rem = Math.max(0, (state.cornerKickPaceUsed ?? 0) - stepDistance);
      return rem > 0
        ? { cornerKickPaceUsed: rem }
        : { cornerKickMovedPieceId: null, cornerKickPaceUsed: 0 };
    })()
  : {};
```

Also strengthen the masking test to assert the piece actually reverted position (and that no
`GAME_ERROR` fired) instead of only checking `state.phase`.

### CR-02: `applyUndo` succeeds in `CORNER_KICK_REPOSITION` but never refunds `cornerKickUsedPace` / `cornerKickStagePlacedIds` — silent per-piece budget corruption

**File:** `packages/server/src/gameEngine.ts:1762-1829` (`lockReset` in `applyUndo`)
**Issue:**
Unlike `CORNER_KICK_FINAL_SETUP` (CR-01), a move made during `CORNER_KICK_REPOSITION` IS
logged as a plain `'MOVE'` event (by design — see `gameHandlers.ts:786-807`, which explicitly
constructs the `MOVE` event itself because `applyCornerKickReposition` deliberately does not).
This means `applyUndo` correctly locates and reverses the move: the piece's position is
restored and the `MOVE` event is removed from `eventLog`, so `applyUndo` returns `ok: true`.

However, `applyCornerKickReposition` (gameEngine.ts:3866-3931) tracks two additional pieces of
state on every successful move: `cornerKickUsedPace[pieceId]` (incremented, cap 6 — explicitly
documented as mirroring `goalKickUsedPace`'s per-piece 6-hex budget) and
`cornerKickStagePlacedIds` (the stage's 2-distinct-piece cap). `applyUndo`'s `lockReset`
ternary (gameEngine.ts:1762-1829) has explicit branches that correctly decrement the analogous
`goalKickUsedPace` field for `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` — but there is
**no branch at all for `CORNER_KICK_REPOSITION`**, so it falls through to the final `{}` case.

Net effect: after undoing a corner-kick reposition move, the piece's position visually reverts,
but `cornerKickUsedPace[pieceId]` is never decremented and the piece is never removed from
`cornerKickStagePlacedIds`. The consumed pace is permanently lost from that piece's 6-hex
budget for the rest of the `CORNER_KICK_REPOSITION` window, and the piece continues to count
against the stage's 2-distinct-piece cap even though its move was reverted — silently
penalizing a player for using Undo (the opposite of Undo's intended behaviour) and,
in the 2-distinct-pieces-per-stage case, potentially blocking a third, different piece from
being selected that stage even though the board only shows one piece having actually moved.

**Fix:** Add a `CORNER_KICK_REPOSITION` branch to `lockReset`, mirroring the
`GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` branch's per-piece pace-map decrement, and also
remove `moveToUndo.pieceId` from `cornerKickStagePlacedIds` when its `cornerKickUsedPace` entry
becomes fully unwound within the current stage:

```ts
: state.phase === 'CORNER_KICK_REPOSITION'
  ? (() => {
      const currentUsed = state.cornerKickUsedPace?.[moveToUndo.pieceId] ?? 0;
      const rem = Math.max(0, currentUsed - stepDistance);
      const nextUsedPace = { ...(state.cornerKickUsedPace ?? {}) };
      if (rem > 0) {
        nextUsedPace[moveToUndo.pieceId] = rem;
      } else {
        delete nextUsedPace[moveToUndo.pieceId];
      }
      return { cornerKickUsedPace: nextUsedPace };
    })()
  : {};
```

(Whether an undone-to-zero piece should also be dropped from `cornerKickStagePlacedIds` is a
rules question — CORNER-03's `applyCornerKickStageEnd` doc comment implies the 2-piece cap is
per-stage-touch, so this should likely also be cleared; needs a design decision, but at minimum
the pace-budget refund above must be fixed.)

## Warnings

### WR-01: `buildReplayFrames` never applies `CORNER_KICK_GK_PLACE` / `CORNER_KICK_MOVE` piece positions — replay desyncs after any corner-kick GK placement or final-setup reposition

**File:** `packages/server/src/gameEngine.ts:6813-6909` (event-processing loop in `buildReplayFrames`)
**Issue:**
The replay-frame reconstruction loop has special-cased handling for `MOVE`, `KICK_OFF_SETUP`,
`THROW_IN_PLACE`, and `CORNER_KICK_TAKER_PLACED` (all accumulate into `moveGroup` and update
`current.pieces` via `flushMoveGroup`), plus a top-of-loop skip list for events that carry no
board change (`SLOT_ADVANCE`, `DEFLECT_ATTEMPT`, `GOAL_KICK_WINDOW_ADVANCE`,
`GOAL_KICK_CHOICE`, `GOAL_KICK_MOVE`).

`CORNER_KICK_GK_PLACE` and `CORNER_KICK_MOVE` are in neither category: they are correctly
excluded from `REPLAY_ELIGIBLE_TYPES` (so no frame is emitted for them, which matches intent —
see the comment at gameEngine.ts:6689-6691), but they are also never used to update
`current.pieces`. Since `current.pieces` is the running state threaded through the rest of the
reconstruction, any piece moved via `CORNER_KICK_GK_PLACE` (either goalkeeper's placement
during the two CORNER-01 reposition windows) or `CORNER_KICK_MOVE` (a piece's final-setup
reposition, CORNER-06) is left at its **pre-corner-kick position** for every subsequent replay
frame, until (if ever) a later `MOVE`/other tracked event happens to reposition that same piece
again.

This is a real display-correctness bug in the end-of-match replay feature: a goalkeeper who
repositioned for a corner, or a defender/attacker who shuffled during the pre-kick window, will
appear to teleport back to a stale position for the remainder of the replay stream.

**Fix:** Add `CORNER_KICK_GK_PLACE` and `CORNER_KICK_MOVE` to the piece-position-tracking path,
e.g. treat them like `KICK_OFF_SETUP` (position-only update, ball unchanged) since neither event
carries `ballAfter`:

```ts
if (event.type === 'CORNER_KICK_GK_PLACE' || event.type === 'CORNER_KICK_MOVE') {
  const existing = moveGroup.get(event.pieceId) ?? [];
  existing.push({ to: event.to, ballAfter: current.ball }); // ball unchanged
  moveGroup.set(event.pieceId, existing);
  continue;
}
```

### WR-02: Magic number `2` duplicates `CORNER_KICK_STAGES[stageIndex].max` instead of reading it

**File:** `packages/server/src/gameEngine.ts:3908-3912` (`applyCornerKickReposition`)
**Issue:** The per-stage distinct-piece cap is hardcoded as the literal `2`:

```ts
const stagePlacedIds = state.cornerKickStagePlacedIds ?? [];
const alreadyCountedThisStage = stagePlacedIds.includes(pieceId);
if (!alreadyCountedThisStage && stagePlacedIds.length >= 2) {
```

`packages/shared/src/offside.ts`'s `CORNER_KICK_STAGES` is documented as the single source of
truth for each stage's `max` (currently `2` for all six stages), and
`CornerKickSetupPanel.tsx`/`useGameStore.ts` both correctly read `stage.max` /
`CORNER_KICK_STAGES[stageIndex].max` rather than hardcoding `2`. If `CORNER_KICK_STAGES` is
ever edited to vary `max` per stage (as `FREE_KICK_STAGES` already does — 4/4/3/2), this
hardcoded `2` in the engine's own enforcement path would silently diverge from the client's
displayed budget and from the table's documented values, without any compiler or test signal.
**Fix:** Replace the literal with `CORNER_KICK_STAGES[state.cornerKickStageIndex].max`.

### WR-03: `gameHandlers.cornerKick.test.ts`'s Undo coverage does not verify Undo's actual effect

**File:** `packages/server/src/__tests__/gameHandlers.cornerKick.test.ts:978-993`
**Issue:** As detailed in CR-01, the test `'CORNER_KICK_FINAL_SETUP accepts Undo after a move'`
only asserts `state.phase === 'CORNER_KICK_FINAL_SETUP'` on the `GAME_STATE` event following
`GAME_UNDO`. Because the server broadcasts `GAME_STATE` on both the success and failure path of
`GAME_UNDO` (`gameHandlers.ts:1606-1613`), and the phase never changes on failure either, this
assertion is satisfied identically whether Undo succeeded or silently failed with a
`GAME_ERROR`. The test's name ("accepts Undo after a move") asserts a claim the test body does
not actually check. The sibling `CORNER_KICK_REPOSITION accepts Undo after a move` test
(line 963) has the identical shape/weakness, and additionally cannot catch CR-02 (it never
inspects `cornerKickUsedPace`/`cornerKickStagePlacedIds` after the undo).
**Fix:** Assert the moved piece's `position` reverted to its pre-move hex, and that no
`ServerEvents.GAME_ERROR` was emitted during the undo round-trip (e.g. race the `GAME_ERROR`
event with a short timeout, or check `room.gameState` directly in a server-side unit test via
`applyUndo`). For the `CORNER_KICK_REPOSITION` case, also assert `cornerKickUsedPace` was
decremented back to its pre-move value.

---

_Reviewed: 2026-08-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
