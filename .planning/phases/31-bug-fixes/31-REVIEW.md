---
phase: 31-bug-fixes
reviewed: 2026-07-22T17:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/server/src/__tests__/gameEngine.rule11.test.ts
  - packages/server/src/__tests__/gameHandlers.phase10.test.ts
  - packages/server/src/__tests__/replay.integration.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/shared/src/types.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-07-22
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 31 shipped four plans: BUG-30 (replay piece reconstruction), BUG-31 (eligible-players/End-Turn timing), BUG-32 (goalkeeper deflection selection), and a folded header-winner eligibility fix. Since the listed files are large and mostly pre-existing, I scoped the actual line-level review to the real diff for this phase (`git diff 7e67a8b..HEAD` — the commit before `31-CONTEXT.md` was authored), which is an 11-file, ~519-line changeset, and read the surrounding non-diff code (`applyStartMovement`, `applyMove`, `buildReplayFrames`, `canSelect*` gates) needed to trace each fix through to its actual effect at runtime. I also ran `typecheck` on all three packages and the three relevant test files to confirm the merged state (including the rebuilt `packages/shared` mentioned in phase context) is not stale — all green, no staleness found.

BUG-31 (ActionPanel `remaining` derivation) and the client/server halves of BUG-32 (GK deflection gate) are both correctly implemented and match their stated intent; I traced the data flow for each and could not find a defeating interaction.

However, two of the four plans have real, verifiable correctness gaps that were not caught by their own regression tests:

1. **The folded header-winner fix (31-04) does not survive into the Movement Phase it is meant to protect.** `applyStartMovement` unconditionally resets `movedPieceIds: []` on every PASS→MOVE transition, which is the only way to reach the Movement Phase after a header resolves. I verified this empirically by driving `applyResolveHeaderTarget` → `applyStartMovement` back-to-back: the winner's id is present in `movedPieceIds` immediately after the header resolves, and is gone by the time the Movement Phase state is produced. BUG-31's own bug report explicitly requires the piece to be "ineligible... in the next movement phase" — this requirement is not met in the real game flow.
2. **BUG-30's replay fix is incomplete.** Three GK-out-of-range auto-GOAL construction sites in `gameHandlers.ts` (SNAPSHOT_DEFLECT, declared shot, and header-at-goal flows) reset `state.pieces` via `buildKickOffPieces()` but never populate the new `piecesAfter` field on their `GOAL` events. `buildReplayFrames` only reconstructs pieces when `piecesAfter` is present, so replaying a goal scored via any of these three reachable paths still shows every player frozen at stale pre-goal positions for the rest of the replay — the exact defect class BUG-30 was supposed to close, left open. This gap is documented by the 31-01 SUMMARY as a known, unfixed follow-up, not resolved elsewhere in this phase's commits.

## Critical Issues

### CR-01: Header-winner `movedPieceIds` fix is wiped by `applyStartMovement` before the Movement Phase begins

**File:** `packages/server/src/gameEngine.ts:3526-3530`, `:3555-3559` (the fix), and `:456-465` (the reset that defeats it)

**Issue:** `applyResolveHeaderTarget`'s two non-goal branches append the header-duel winner's piece id to `movedPieceIds` so the piece renders "spent" (grey ring, unselectable) in the following Movement Phase — this is exactly what the folded todo (`2026-07-12-bug-header-winner-piece-ineligible-next-phase.md`) asked for, and what the new regression tests in `gameEngine.rule11.test.ts` assert.

But the only way to reach the Movement Phase from the `PASS` phase that `applyResolveHeaderTarget` transitions into is `GAME_START_MOVEMENT` → `applyStartMovement` (`gameEngine.ts:435`). That function unconditionally does:

```ts
return {
  ok: true,
  state: {
    ...state,
    phase: 'MOVE',
    movementSlot: 'ATTACKER_4',
    ...
    movedPieceIds: [],       // <-- always reset, no exception for header-winner
    paceUsedByPieceId: {},
    contestedPieceIds: [],   // <-- same defeat already affects the pre-existing HEAD-05 mechanism
    ...
  },
};
```

I verified this empirically (temporarily instrumenting `gameEngine.rule11.test.ts`, run, then reverted — working tree is clean):

```
PASS phase movedPieceIds: [ 'home-fwd' ]
MOVE phase movedPieceIds: []
MOVE phase phase: MOVE
```

The client's `canSelect` gate for the Movement Phase (`HexGrid.tsx:706-711`) and the ActionPanel's `remaining` count both key off `movedPieceIds`, so by the time a player actually reaches the Movement Phase, the header-winning piece is fully selectable again — the bug this plan targeted is unfixed in the real game flow. All four new tests in `gameEngine.rule11.test.ts` pass because they only assert against the intermediate `PASS`-phase state returned directly by `applyResolveHeaderTarget`; none of them additionally pipes that state through `applyStartMovement`, so the regression suite gives false confidence that BUG-31 (header-winner family) is closed.

Note this is not a new pattern in this phase — the adjacent `contestedPieceIds` field (HEAD-05, D-21) suffers the identical defeat (also reset unconditionally in the same `applyStartMovement` call), and `applyMove`'s own comment at `gameEngine.ts:668-673` already acknowledges the check is effectively dead in the standard path ("contestedPieceIds is cleared in applyStartMovement after one Movement Phase, but may be injected on state by tests or carried from a non-standard path"). The 31-04 fix reused a pattern that was already known-broken one field over, without noticing.

**Fix:** Either (a) special-case `applyStartMovement` to preserve `movedPieceIds` entries that were added by a header resolution (e.g. track them in a dedicated field like the existing `contestedPieceIds`, and merge that field into `movedPieceIds` rather than clobbering it), or (b) don't reset `movedPieceIds` unconditionally — only clear entries that belong to the team about to move, or carry forward entries flagged as "carried from a prior phase, not a Movement-Phase activation." At minimum, add a regression test that chains `applyResolveHeaderTarget` → `applyStartMovement` and asserts the winner's id is still present in the resulting `MOVE`-phase state's `movedPieceIds`, to prevent this from silently regressing again.

### CR-02: BUG-30 replay-reconstruction fix leaves 3 known GOAL sites unfixed — goals scored via GK-out-of-range auto-goal still replay with stale piece positions

**File:** `packages/server/src/gameHandlers.ts:1013-1043` (SNAPSHOT_DEFLECT out-of-range auto-goal), `:1657-1687` (declared-shot out-of-range auto-goal), `:2438-2467` (header-at-goal out-of-range auto-goal)

**Issue:** All three sites reset the live game's `state.pieces` to the new kickoff formation:

```ts
room.gameState = {
  ...baseSnapState, // / declaredState / headerTargetState
  pieces: buildKickOffPieces(newKickOffTeam, ...selectedTeams, ...selectedFormation),
  phase: 'KICK_OFF_SETUP',
  ...
  eventLog: [
    ...baseSnapState.eventLog,
    outOfRangeEvent,
    { type: 'GOAL' as const, scoringTeam, scorerId: outOfRangeEvent.shooterId, timestamp: Date.now(), ballAfter: {...} },
    // no piecesAfter here
  ],
};
```

`buildReplayFrames` (`gameEngine.ts:4686-4698`) only reconstructs pieces for a `GOAL` event when `event.piecesAfter` is present — it's optional precisely so these three sites (owned by a concurrently-executing sibling plan) wouldn't need touching. That containment decision was reasonable for avoiding a merge conflict, but it left the underlying defect open: any goal scored because the GK has no reachable hex within 3 hexes of the shot path (a normal, non-exotic outcome — it fires whenever the goalkeeper is badly out of position on a shot, snapshot, or header) will replay with every player frozen at their pre-goal positions for the remainder of the match's replay, exactly the symptom BUG-30 was filed to fix. This is documented candidly in the 31-01 SUMMARY's "Known Follow-up Gap" section as unresolved, and no later commit in this phase closes it.

**Fix:** Apply the same `resetPieces`-hoist-then-attach pattern used in the two `gameEngine.ts` sites to all three `gameHandlers.ts` sites:

```ts
const resetPieces = buildKickOffPieces(newKickOffTeam, baseSnapState.selectedTeams, baseSnapState.selectedFormation);
room.gameState = {
  ...baseSnapState,
  pieces: resetPieces,
  ...
  eventLog: [
    ...baseSnapState.eventLog,
    outOfRangeEvent,
    { type: 'GOAL' as const, scoringTeam, scorerId: outOfRangeEvent.shooterId, timestamp: Date.now(), ballAfter: {...}, piecesAfter: resetPieces },
  ],
};
```

Add regression coverage mirroring `replay.integration.test.ts`'s new BUG-30 test, but driving the GK-out-of-range branch through the real `GAME_MOVE`/`GAME_SHOT`/`GAME_HEADER_TARGET` socket handlers instead of `applyRoll`.

## Warnings

### WR-01: `ActionEventType` union silently drifted out of sync with `ActionEvent`

**File:** `packages/shared/src/types.ts:65-107` (declaration), `:168` (new member not mirrored here)

**Issue:** `ActionEventType` is documented (both in its own JSDoc context and in `packages/shared/README.md`) as "String literal union of all `ActionEvent` discriminants." This phase added a new `ActionEvent` union member, `'HALF_TIME_KICKOFF_RESET'` (types.ts:168), but did not add the corresponding literal to `ActionEventType` (types.ts:65-107). The two types are maintained by hand in parallel rather than one being derived from the other (e.g. `ActionEvent['type']`), so nothing enforces the invariant the doc comment claims. Currently `ActionEventType` isn't consumed anywhere else in the codebase, so there's no active bug today — but the type is exported from the shared package's public surface, and any future consumer that trusts it as exhaustive (e.g. a switch statement, a Zod enum, a client-side filter dropdown) will silently miss `HALF_TIME_KICKOFF_RESET`.

**Fix:** Either derive `ActionEventType` from `ActionEvent` directly (`export type ActionEventType = ActionEvent['type'];`) so it can never drift again, or add `'HALF_TIME_KICKOFF_RESET'` to the manual list now and add a compile-time check (e.g. a type-level assertion that the two stay equal) to catch future drift.

---

_Reviewed: 2026-07-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
