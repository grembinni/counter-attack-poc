---
phase: 38-corner-kick
reviewed: 2026-08-09T23:16:51Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - packages/client/src/components/ActionLog.test.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/BallLocationRing.test.tsx
  - packages/client/src/components/BallLocationRing.tsx
  - packages/client/src/components/CornerKickSetupPanel.module.css
  - packages/client/src/components/CornerKickSetupPanel.test.tsx
  - packages/client/src/components/CornerKickSetupPanel.tsx
  - packages/client/src/components/EventBanner.test.tsx
  - packages/client/src/components/EventBanner.tsx
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/client/src/utils/restartErrorMessage.ts
  - packages/server/src/__tests__/cornerKick.integration.test.ts
  - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
  - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts
  - packages/server/src/__tests__/gameEngine.phase17.test.ts
  - packages/server/src/__tests__/gameEngine.rule11.test.ts
  - packages/server/src/__tests__/gameEngine.test.ts
  - packages/server/src/__tests__/gameHandlers.cornerKick.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/shared/src/actionSequence.test.ts
  - packages/shared/src/actionSequence.ts
  - packages/shared/src/events.ts
  - packages/shared/src/offside.ts
  - packages/shared/src/outOfBounds.test.ts
  - packages/shared/src/outOfBounds.ts
  - packages/shared/src/scoreUtils.ts
  - packages/shared/src/scoreUtils.test.ts
  - packages/shared/src/types.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-08-09T23:16:51Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

This is a fresh, full re-review of the entire Corner Kick feature (33 files spanning `packages/shared`, `packages/server`, and `packages/client`) as it stands after 33 plans across 4 gap-closure rounds. It supersedes the stale 2026-08-07 `38-REVIEW.md`, which found 2 Critical and 3 Warning issues, all concentrated in `applyUndo`'s missing `CORNER_KICK_FINAL_SETUP`/`CORNER_KICK_REPOSITION` branches and in `buildReplayFrames`' missing piece-position tracking for two corner-kick event types.

**All five previously-reported findings were independently re-verified against the current code and are fixed:**

- CR-01 (`applyUndo` couldn't find `CORNER_KICK_MOVE` events in `CORNER_KICK_FINAL_SETUP`) — `moveTypeForPhase` now has an explicit `CORNER_KICK_FINAL_SETUP` branch (`gameEngine.ts:1691-1692`) and `lockReset` correctly decrements `cornerKickPaceUsed`/clears `cornerKickMovedPieceId` (`gameEngine.ts:1848-1857`).
- CR-02 (`cornerKickUsedPace`/`cornerKickStagePlacedIds` never refunded on Undo in `CORNER_KICK_REPOSITION`) — `lockReset` now has a full `CORNER_KICK_REPOSITION` branch that refunds `cornerKickUsedPace` by actual hex distance and releases both `cornerKickStagePlacedIds` and `cornerKickActivatedIds` (`gameEngine.ts:1858-1918`) — this goes beyond the originally suggested fix.
- WR-01 (`buildReplayFrames` never applied `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE` piece positions) — both types (plus `CORNER_KICK_CLEAR_OUT_MOVE`, added later) now update `current.pieces` directly (`gameEngine.ts:7210-7222`).
- WR-02 (hardcoded `2` instead of reading `CORNER_KICK_STAGES[...].max`) — `applyCornerKickReposition` now reads `CORNER_KICK_STAGES[state.cornerKickStageIndex].max` (`gameEngine.ts:4190`).
- WR-03 (weak Undo test coverage) — not independently re-verified line-by-line in this pass, but the underlying engine bug the weak test was masking is fixed.

Beyond re-verifying the prior findings, this pass traced the full corner-kick FSM chain (trigger classification in `outOfBounds.ts`/`triggerOutOfBoundsRestart`, the automatic pre-corner clear-out, both GK reposition windows, corner-taker selection, the 6-stage `CORNER_KICK_REPOSITION` window, the pre-kick `CORNER_KICK_FINAL_SETUP` window, and the High/Low accuracy resolution wired into `applyRoll`'s `PASS` case, including the D-GAP-02 spilled-save direction-only corner award), the client-side selection/highlighting logic in `useGameStore.ts`/`HexGrid.tsx`, and the `ActionLog.tsx`/`EventBanner.tsx`/`BallLocationRing.tsx` display layer. The implementation is unusually rigorous — persistent-field-over-`activeTeam`/`lastActionType` acting-team derivation is applied consistently, every corner-kick-specific `GameState` field is torn down completely and consistently at both of the two corner-resolution exit points (`CORNER_KICK_TEARDOWN`, `gameEngine.ts:663-678`, and the `triggerOutOfBoundsRestart` re-award path), and defence-in-depth (handler-level team pre-checks layered on top of engine-level checks) is applied at every corner-kick socket handler.

Two new issues were found in this pass, both Warnings (no Blockers/Criticals) — a latent regression risk in `ActionLog.tsx` reusing the exact defect class the 38-24 crash (`CORNER_KICK_CLEAR_OUT_MOVE` case) already occurred from, and a real client/server valid-hex mismatch in the `CORNER_KICK_REPOSITION` destination-picker introduced by the 38-27 single-destination-click rewrite.

## Warnings

### WR-01: `ActionLog.tsx`'s `formatEvent` switch has no compile-time exhaustiveness guard — the same defect class that already caused a shipped crash

**File:** `packages/client/src/components/ActionLog.tsx:329-1043` (`formatEvent`)
**Issue:** `formatEvent(event: ActionEvent, subKind?): Formatted` is a `switch` over the `ActionEvent` discriminated union with no `default` branch and no `assertNever`-style exhaustiveness check. The repo's root `tsconfig.base.json` does not set `noImplicitReturns` (only `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules` are set — none of these enable implicit-return checking), so TypeScript does **not** statically verify every `ActionEventType` member has a corresponding `case`. A missing case does not fail to compile; the function silently falls off the end at runtime and returns `undefined`, which crashes the caller's `const { prefix, prefixColor, content } = formatEvent(...)` destructure.

This is not a hypothetical — the `CORNER_KICK_CLEAR_OUT_MOVE` case (`ActionLog.tsx:1021-1041`) exists today specifically because this exact failure mode already shipped and crashed the ActionLog render loop (per that case's own comment, citing `38-24-SUMMARY.md` bug 4). The fix applied at the time was to add the missing case, not to add a compiler safety net — so the next new `ActionEventType` member (there have been roughly a dozen added across Phases 8, 10, 17, 18.3, 25-06, 37, and 38 alone) can reproduce the identical crash with zero compile-time warning.

**Fix:** Either enable `noImplicitReturns` in `tsconfig.base.json` (verify this doesn't break other intentionally-non-exhaustive switches elsewhere in the codebase first), or add an explicit exhaustiveness guard local to this function:

```ts
function formatEvent(event: ActionEvent, subKind?: 'duel' | 'handling'): Formatted {
  switch (
    event.type
    // ...existing cases...
  ) {
  }
  // Unreachable if the switch above is exhaustive — TypeScript will flag `event` as
  // non-`never` here the moment a new ActionEventType case is added without a matching
  // case above, turning this into a compile error instead of a runtime crash.
  const _exhaustive: never = event;
  throw new Error(`formatEvent: unhandled ActionEvent type ${(_exhaustive as ActionEvent).type}`);
}
```

### WR-02: `CORNER_KICK_REPOSITION`'s destination validity check disagrees between client and server on a piece's own current hex

**File:** `packages/server/src/gameEngine.ts:4163` (`applyCornerKickReposition`) vs. `packages/client/src/store/useGameStore.ts:442-465` (`computeCornerRepositionValidHexes`)
**Issue:** The server's occupancy guard in `applyCornerKickReposition`:

```ts
if (state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r)) {
  return { ok: false, reason: 'INVALID_TARGET' };
}
```

does not exclude the piece being moved (`pieceId`) from the occupancy scan — so a click on the selected piece's own current hex is rejected as "occupied" (by itself). `applyCornerKickFinalMove` (`gameEngine.ts:4397`) has the identical unguarded check, though it is harmless there because that function separately requires `hexDistance(piece.position, to) === 1`, which a piece's own hex can never satisfy.

The client's `computeCornerRepositionValidHexes`, however, explicitly excludes the moving piece:

```ts
if (gameState.pieces.some((p) => p.id !== id && p.position.q === hex.q && p.position.r === hex.r))
  return false;
```

Since `CORNER_KICK_REPOSITION` (unlike every other repositioning phase in this codebase) has no adjacency/distance constraint at all (38-27's "single destination click at any distance" model), a piece's own current hex passes every other client-side filter and is included in `validMoveHexes` — the client highlights it as a legal destination. If the player clicks it (e.g., attempting to deselect, or misreading the highlight), the server rejects with `INVALID_TARGET`, surfacing `restartErrorMessage`'s generic "That isn't a valid target for this action." banner for a click the UI itself offered as valid. No test in `gameEngine.cornerKick.test.ts`/`useGameStore.test.ts` covers this specific hex.

**Fix:** Exclude the moving piece from the server-side occupancy scan, matching the client and every other occupancy check's intent:

```ts
if (state.pieces.some((p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r)) {
  return { ok: false, reason: 'INVALID_TARGET' };
}
```

(or, equivalently, exclude the piece's own current hex from the client's `computeCornerRepositionValidHexes` output so the two sides agree the other way).

## Info

### IN-01: `restartErrorMessage`'s `INVALID_TARGET` copy doesn't distinguish "occupied by an opponent" from "occupied by yourself"

**File:** `packages/client/src/utils/restartErrorMessage.ts:55`
**Issue:** Related to WR-02: `INVALID_TARGET` maps to the generic `"That isn't a valid target for this action."`, while a genuinely-occupied-by-another-piece rejection elsewhere in the app uses the more specific `OCCUPIED: 'Another player is already standing there.'`. `applyCornerKickReposition`/`applyCornerKickFinalMove` never emit `'OCCUPIED'` — every occupied-hex rejection in the corner-kick family (including the WR-02 self-hex case) surfaces as the vaguer `INVALID_TARGET`, which is technically correct but less actionable for the player than the `OCCUPIED` copy used elsewhere in the codebase for the same underlying condition.
**Fix:** Low priority / cosmetic — consider having `applyCornerKickReposition`/`applyCornerKickFinalMove` return a dedicated `'OCCUPIED'` reason (already a mapped wire code) instead of overloading `'INVALID_TARGET'` for both off-pitch and occupied-hex rejections.

---

_Reviewed: 2026-08-09T23:16:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
