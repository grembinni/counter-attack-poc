---
phase: 26-bug-fixes
verified: 2026-07-12T12:23:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 26: Bug Fixes — Verification Report

**Phase Goal:** Known gameplay defects are corrected — undo is scoped to the current phase, button color logic matches move-slot state, opponent stats are accessible on click, deflection logs use the correct format, header targeting lands on a valid goal-side hex, and shot range validation uses the correct distance calculation.
**Verified:** 2026-07-12T12:23:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                              | Status     | Evidence                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Player cannot undo moves from a previous turn or phase; the undo button is disabled when no moves have been made in the current phase (BUG-24)     | ✓ VERIFIED | `gameEngine.ts:1442` adds `&& state.phase !== 'FREE_KICK_SETUP'` to hasPriorMoves gate; `ActionPanel.tsx:251` guards with `freeKickPlacedPieceIds.length === 0`; 5-test suite passes               |
| 2   | The End Turn button is yellow while move options remain and turns green only when all movement options for the current slot are exhausted (BUG-25) | ✓ VERIFIED | `ActionPanel.tsx:981` uses `ctaButtonClass(remaining ?? 0)`; tests assert `ctaButtonPending` when remaining > 0 and `ctaButtonReady` when remaining <= 0; 40 ActionPanel tests pass                |
| 3   | Clicking an opponent's activated player opens that player's stats panel (BUG-26)                                                                   | ✓ VERIFIED | `HexGrid.tsx:898-899` adds `movedPieceIds.includes(piece.id) ? () => inspectPiece(piece.id) : () => undefined` before the no-op fallback; 39 HexGrid tests pass                                    |
| 4   | Deflection log entries appear as `failed to deflect — [reason]` consistently (BUG-27)                                                              | ✓ VERIFIED | `ActionLog.tsx:322` renders `— {rangeLabel}, {rollStr}` unconditionally; two BUG-27 regression tests verify band A and band B NO_DEFLECT format; 26 ActionLog tests pass                           |
| 5   | Winning a header duel results in a valid goal-side target hex being assigned; no invalid or unreachable hex is used (BUG-28)                       | ✓ VERIFIED | `applyResolveHeaderTarget` uses `referencePosition = resolvedWinner?.position ?? state.ball.position`; 4-test regression suite proves contestant-position reference; 10 BUG-28/29 tests pass       |
| 6   | Standard shot range validation correctly rejects shots from outside valid distance using the correct distance calculation (BUG-29)                 | ✓ VERIFIED | `applyDeclareShot` gate is `hexDistance(shooter.position, goalHex) > 11`; `hexDistance` converts ODD-Q offset to cube; server constant 11 matches `ActionPanel.tsx:781` (`dist <= 11`); tests pass |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact                                                         | Expected                                                   | Status     | Details                                                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts`  | 5-case regression suite for applyUndo scoping (BUG-24)     | ✓ VERIFIED | File exists; 395 lines; 5 tests cover all BUG-24 behavior cases; all pass                              |
| `packages/client/src/components/ActionPanel.tsx`                 | canUndo FREE_KICK_SETUP empty-stage guard + ctaButtonClass | ✓ VERIFIED | Line 251: FREE_KICK_SETUP guard; Line 981: ctaButtonClass(remaining ?? 0) for MOVE End Turn button     |
| `packages/server/src/__tests__/gameEngine.phase26-rules.test.ts` | 10-case regression suite for BUG-28 and BUG-29             | ✓ VERIFIED | File exists; 346 lines; 4 BUG-28 + 6 BUG-29 tests; all pass                                            |
| `packages/server/src/gameEngine.ts`                              | applyUndo NOTHING_TO_UNDO fix for FREE_KICK_SETUP          | ✓ VERIFIED | Line 1442: `if (hasPriorMoves && state.phase !== 'FREE_KICK_SETUP')` — BUG-24 server fix confirmed     |
| `packages/client/src/components/HexGrid.tsx`                     | Opponent activated-piece inspectPiece branch               | ✓ VERIFIED | Lines 898-899: `movedPieceIds.includes(piece.id) ? () => inspectPiece(piece.id) : () => undefined`     |
| `packages/client/src/components/ActionLog.tsx`                   | Consistent `failed to deflect — [reason]` format           | ✓ VERIFIED | Line 322: `'failed to deflect' — {rangeLabel}, {rollStr}` unconditionally; no production change needed |

### Key Link Verification

| From                                     | To                                                     | Via                                            | Status  | Details                                                                                        |
| ---------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `ActionPanel.tsx` canUndo IIFE           | `gameState.freeKickPlacedPieceIds`                     | `useGameStore` selector at line 114            | ✓ WIRED | `freeKickPlacedPieceIds` selector exists at line 114; guard at line 251 references it directly |
| `gameEngine.ts applyUndo`                | `FK_STAGE_ADVANCE` / `FK_KICKER_CHOSEN` boundary       | `lastSlotAdvanceIdx` reduce at lines 1394-1403 | ✓ WIRED | Both event types included in `isBoundary` check at lines 1400-1401                             |
| `ActionPanel.tsx MOVE End Turn button`   | `ctaButtonClass(remaining ?? 0)`                       | className computed from eligibleRemaining      | ✓ WIRED | Line 981: `ctaButtonClass(remaining ?? 0)` replaces former hard-coded `ctaButtonReady`         |
| `HexGrid.tsx handleClick`                | `inspectPiece(piece.id)`                               | opponent activated-piece terminal branch       | ✓ WIRED | Lines 898-899 before `() => undefined`; no teamId constraint; `canSelect` already false        |
| `gameEngine.ts applyResolveHeaderTarget` | `resolveHeaderWinnerPiece(state, winnerTeam).position` | `referencePosition` derivation                 | ✓ WIRED | `referencePosition = resolvedWinner?.position ?? state.ball.position` confirmed in code        |
| `gameEngine.ts applyDeclareShot`         | `hexDistance(shooter.position, goalHex)`               | regular shot range gate > 11                   | ✓ WIRED | Confirmed cube-consistent via ODD-Q → cube conversion in `hexDistance`; constant = 11          |

### Behavioral Spot-Checks

| Behavior                                     | Command                                            | Result                | Status |
| -------------------------------------------- | -------------------------------------------------- | --------------------- | ------ |
| applyUndo NOTHING_TO_UNDO for empty FK stage | `pnpm test -- gameEngine.phase26-undo` (5 tests)   | 5/5 passed — 5ms      | ✓ PASS |
| BUG-28/29 range rules regression suite       | `pnpm test -- gameEngine.phase26-rules` (10 tests) | 10/10 passed — 5ms    | ✓ PASS |
| ActionPanel canUndo + ctaButtonClass         | `pnpm test -- ActionPanel` (40 tests)              | 40/40 passed — 203ms  | ✓ PASS |
| HexGrid inspectPiece for opponent piece      | `pnpm test -- HexGrid` (39 tests)                  | 39/39 passed — 3796ms | ✓ PASS |
| ActionLog deflect format                     | `pnpm test -- ActionLog` (26 tests)                | 26/26 passed — 78ms   | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                               | Status      | Evidence                                                                                |
| ----------- | ----------- | ----------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| BUG-24      | 26-01       | Undo scoped to current phase; disabled when no moves in current phase or all undone       | ✓ SATISFIED | Server fix + client guard + 5-test regression suite; ActionPanel 2 new tests            |
| BUG-25      | 26-03       | MOVE End Turn button yellow while options remain, green when slot exhausted               | ✓ SATISFIED | `ctaButtonClass(remaining ?? 0)` on MOVE End Turn button; 2 new ActionPanel tests       |
| BUG-26      | 26-03       | Clicking opponent activated player opens stats panel                                      | ✓ SATISFIED | New `inspectPiece` branch in HexGrid handleClick; 2 new HexGrid tests                   |
| BUG-27      | 26-03       | Deflection log uses `failed to deflect — [reason]` format consistently                    | ✓ SATISFIED | ActionLog.tsx format confirmed already correct; 2 new ActionLog tests lock the format   |
| BUG-28      | 26-02       | Header duel attacker win uses winning contestant position for target range check          | ✓ SATISFIED | `referencePosition` confirmed correct; 4-case regression suite added                    |
| BUG-29      | 26-02       | Standard shot range uses cube-consistent hexDistance at constant 11; client/server parity | ✓ SATISFIED | hexDistance cube-correct confirmed; boundary tests at 11 (accept) and 12 (reject) added |

No orphaned requirements — all 6 Phase 26 IDs from REQUIREMENTS.md traceability table are covered.

### Anti-Patterns Found

| File                                             | Line | Pattern | Severity | Impact |
| ------------------------------------------------ | ---- | ------- | -------- | ------ |
| No debt markers found in any phase-modified file | —    | —       | —        | —      |

Scanned for TBD, FIXME, XXX, TODO, HACK, PLACEHOLDER, placeholder, "coming soon", "not yet implemented", "not available" in:

- `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` — clean
- `packages/server/src/__tests__/gameEngine.phase26-rules.test.ts` — clean
- `packages/server/src/gameEngine.ts` — clean
- `packages/client/src/components/ActionPanel.tsx` — clean
- `packages/client/src/components/HexGrid.tsx` — clean
- `packages/client/src/components/ActionLog.tsx` — clean

### Commit Verification

All commits referenced in SUMMARYs are present in the git log:

| Commit  | Plan | Description                                                            |
| ------- | ---- | ---------------------------------------------------------------------- |
| 9cbf7b1 | 01   | RED: failing regression suite for applyUndo FREE_KICK_SETUP scoping    |
| c5953c8 | 01   | GREEN: fix applyUndo to return NOTHING_TO_UNDO for empty FK stage      |
| 011f201 | 01   | RED: failing test for freeKickPlacedPieceIds empty-stage canUndo guard |
| 5ad8872 | 01   | GREEN: add freeKickPlacedPieceIds empty-stage guard to canUndo         |
| ab1ffc4 | 02   | test: BUG-28 + BUG-29 regression suite (10 tests; no prod change)      |
| d466b63 | 03   | fix: BUG-25 MOVE End Turn button color via ctaButtonClass              |
| 7b3566c | 03   | fix: BUG-26 clicking opponent activated piece opens stats panel        |
| 573a88a | 03   | test: BUG-27 lock failed-to-deflect format for both bands              |

### Human Verification Required

None — all behavioral correctness is covered by automated tests. The PLAN verification sections marked the browser-tab checks as "optional" since all behaviors are already asserted by unit tests that fire real DOM events, assert CSS class names, and verify render output.

### Gaps Summary

No gaps found. All 6 success criteria from ROADMAP.md are verified with evidence in the actual codebase: code changes exist at the correct locations, tests are substantive (not stubs), all 120 targeted tests pass, and no debt markers are present in modified files.

---

_Verified: 2026-07-12T12:23:00Z_
_Verifier: Claude (gsd-verifier)_
