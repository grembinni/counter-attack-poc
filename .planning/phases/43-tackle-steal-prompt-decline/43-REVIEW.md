---
phase: 43-tackle-steal-prompt-decline
reviewed: 2026-08-23T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - packages/client/src/App.test.tsx
  - packages/client/src/App.tsx
  - packages/client/src/components/ActionLog.test.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/BallLocationRing.test.tsx
  - packages/client/src/components/BallLocationRing.tsx
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameSettingsScreen.test.tsx
  - packages/client/src/components/GameSettingsScreen.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/TackleStealPromptPanel.module.css
  - packages/client/src/components/TackleStealPromptPanel.test.tsx
  - packages/client/src/components/TackleStealPromptPanel.tsx
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/server/src/__tests__/draftReconnect.integration.test.ts
  - packages/server/src/__tests__/draftSession.integration.test.ts
  - packages/server/src/__tests__/gameEngine.substitution.test.ts
  - packages/server/src/__tests__/gameEngine.tackleStealPrompt.test.ts
  - packages/server/src/__tests__/gameEngine.undoReplay43.test.ts
  - packages/server/src/__tests__/gameHandlers.substitution.test.ts
  - packages/server/src/__tests__/gameHandlers.tackleStealPrompt.test.ts
  - packages/server/src/__tests__/room.integration.test.ts
  - packages/server/src/__tests__/substitution.integration.test.ts
  - packages/server/src/__tests__/tackleStealPrompt.integration.test.ts
  - packages/server/src/__tests__/testHelpers.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/server/src/roomHandlers.ts
  - packages/server/src/roomStore.ts
  - packages/shared/src/events.ts
  - packages/shared/src/moveValidator.test.ts
  - packages/shared/src/moveValidator.ts
  - packages/shared/src/stoppagePhases.test.ts
  - packages/shared/src/stoppagePhases.ts
  - packages/shared/src/types.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-08-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

This phase adds a tackle/steal decline-prompt flow (`TACKLE_STEAL_PROMPT`, `applyTackleStealChoice`, `GAME_TACKLE_STEAL_CHOICE`) gated by a new `tackleStealDeclineEnabled` room/game-state toggle, plus the client panel, settings checkbox, and wire-format plumbing to support it.

The server-side state machine (`gameEngine.ts`'s `applyMove` interception, `applyTackleStealChoice`'s decline/attempt/queue/foul-interaction logic, the `stoppagePhases.ts`/`moveValidator.ts` exclusions, and the `gameHandlers.ts` socket handler's guard ordering) was traced in detail against its extensive test suite (`gameEngine.tackleStealPrompt.test.ts`, `gameHandlers.tackleStealPrompt.test.ts`, `tackleStealPrompt.integration.test.ts`, `gameEngine.undoReplay43.test.ts`). The toggle gate is checked with strict `=== true` everywhere, the multi-defender queue ordering/exclusion logic matches `moveValidator.ts`'s tackling-descending sort, the `TACKLE_STEAL_PROMPT`/`TACKLE_STEAL_DECLINED` interaction with `FOUL_CHOICE`, `Undo`, replay (`REPLAY_ELIGIBLE_TYPES`), and `broadcastState`'s GK-interrupt edge-triggering was independently traced end-to-end and found internally consistent with its own extensive commentary and tests. No BLOCKER-level correctness or security defects were found in the new code paths.

Two WARNING-level and two INFO-level quality items are recorded below — none of them alter game behavior, but they represent unreachable/redundant code introduced or duplicated by this phase that a future refactor could trip over.

## Warnings

### WR-01: Duplicated dead "already-attempted" guards in the new toggle-on branches

**File:** `packages/server/src/gameEngine.ts:1286`, `packages/server/src/gameEngine.ts:1388`
**Issue:** Both new toggle-on interception branches re-check membership in `stealAttemptedByIds`/`tackleAttemptedByIds` before entering `TACKLE_STEAL_PROMPT`:

```ts
if (newStealAttemptedByIds.includes(firstDefender!.id)) {
  return { ok: false, reason: 'MOVE_INVALID', detail: 'ALREADY_ATTEMPTED' };
}
```

and

```ts
if (newTackleAttemptedByIds.includes(pieceId)) {
  return { ok: false, reason: 'MOVE_INVALID', detail: 'ALREADY_ATTEMPTED' };
}
```

`result.effect.defenders` (STEAL) and the `TACKLE_ATTEMPT` effect (TACKLE) are only ever produced by `moveValidator.ts` after it has already filtered out ids present in `stealAttemptedByIds`/`tackleAttemptedByIds` (see `moveValidator.ts` lines ~108 and ~142). So `firstDefender!.id` and `pieceId` can never actually be members of the respective arrays at this point — both conditions are unreachable given the current call graph. This mirrors a pre-existing (and equally unreachable) guard a few lines below in the toggle-off path, so it is not a functional regression, but duplicating dead defensive code into two new branches compounds an existing code smell rather than fixing it.
**Fix:** Either remove the redundant checks (relying on `moveValidator.ts` as the single source of truth, matching the comment style used elsewhere in this file for "belt-and-suspenders" checks that are explicitly labeled as such), or add a comment explicitly acknowledging these are defense-in-depth checks against a currently-impossible state, consistent with how other genuinely-defensive checks in this file are documented (e.g. `gameEngine.ts` ~1434 `// Defensive: carrier must exist`).

### WR-02: `TACKLE_STEAL_DECLINED` events are never pruned by `applyUndo`, leaving orphaned log lines after an undo

**File:** `packages/server/src/gameEngine.ts` (`applyUndo`, ~4083-4143)
**Issue:** `applyUndo` locates the move to reverse by scanning for the last event whose `type` matches the phase-appropriate move type (`MOVE` while in `MOVE`), and only that single event is spliced out of `eventLog`. Any `TACKLE_STEAL_DECLINED` event(s) appended after that `MOVE` event (i.e., produced by declining one or more defenders during the prompt sequence the undone move triggered) are left in `eventLog` untouched — confirmed intentional by `gameEngine.undoReplay43.test.ts`'s "applyUndo crosses a TACKLE_STEAL_DECLINED event" test, which explicitly asserts the decline event survives. Functionally this matches the pre-existing `GK_DIVE_AT_FEET_DECLINED` precedent, so it is not a new defect, but it does mean a player can Undo the very move that led to a "declined to challenge" line and that line stays visible in the match log (`ActionLog.tsx`'s `TACKLE_STEAL_DECLINED` case at line 1169) with no corresponding move ever having "happened" from the player's perspective post-undo.
**Fix:** No code change required if this is accepted product behavior (it mirrors an established precedent and is test-locked). If the orphaned log line is undesirable, `applyUndo` would need to additionally strip any `TACKLE_STEAL_DECLINED`/`GK_DIVE_AT_FEET_DECLINED` events between the undone move and the end of the log — a design decision, not a defect, so flagged here for awareness rather than as a required fix.

## Info

### IN-01: Redundant `ball: state.ball` assignment in the TACKLE FAIL branch

**File:** `packages/server/src/gameEngine.ts:2718` (inside `applyTackleStealChoice`)
**Issue:** `tackleFailWouldBeState` explicitly sets `ball: state.ball`, which is already the value inherited from the preceding `...state` spread on the same object literal. The equivalent STEAL FAIL branch (`stealFailWouldBeState`, ~line 2578) omits this redundant line. Purely cosmetic; no behavioral effect.
**Fix:** Drop the redundant `ball: state.ball` line for consistency with the STEAL branch, or add a one-line comment if the explicit restatement is intentional documentation.

### IN-02: `App.tsx`'s discarded `ROOM_SETTINGS_CONFIRMED` boolean parameters silently widen with every new toggle

**File:** `packages/client/src/App.tsx:149-158`
**Issue:** `onRoomSettingsConfirmed` now accepts (and immediately discards) five trailing booleans (`_confirmedFouls`, `_confirmedBooking`, `_confirmedInjury`, `_confirmedTackleStealDecline`), each added by a separate phase, purely to keep the callback signature aligned with `ServerToClientEvents[ServerEvents.ROOM_SETTINGS_CONFIRMED]`. This is documented as deliberate in-line, and is technically correct, but the growing list of positional discarded booleans is a maintainability smell: a future phase adding a 6th toggle has no compiler-enforced reminder to update this call site's parameter list order versus the emitting `roomHandlers.ts` call site's argument order (both are positional, not a named object), so a mismatched insertion point would silently misassign a boolean without a type error.
**Fix:** Not a required fix for this phase (pattern predates Phase 43), but worth flagging for a future consolidation — e.g. changing `ROOM_SETTINGS_CONFIRMED` to a single settings object payload (mirroring `ROOM_SETTINGS_CONFIRM`'s own object-payload shape) would remove the positional-ordering risk entirely.

---

_Reviewed: 2026-08-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
