---
phase: 19-data-model-team-palette
fixed_at: 2026-07-03T18:55:00Z
review_path: .planning/phases/19-data-model-team-palette/19-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-07-03T18:55:00Z
**Source review:** .planning/phases/19-data-model-team-palette/19-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 11 (3 Critical + 8 Warning)
- Fixed: 11
- Skipped: 0

## Fixed Issues

### CR-01, WR-01, WR-05, WR-08: ActionLog.tsx — null guards, name fix, comment, isGoal

**Files modified:** `packages/client/src/components/ActionLog.tsx`
**Commit:** deef2d5
**Applied fix:**

- CR-01 (`pieceColorOf`, `slotTeamColor`): Added optional chaining on `state.gameState?.selectedTeams` and `TEAM_CONFIGS[teamId]?.palette.primary ?? '#888888'` fallback. Both functions now return `'#888888'` when `selectedTeams` is undefined, preventing TypeError crashes on early renders.
- WR-01 (`pieceName`): Changed `\`${piece.firstName} ${piece.lastName}\`` to `piece.lastName ? \`${piece.firstName} ${piece.lastName}\` : piece.firstName`. Mononym players (e.g. Rodri, Pedri with empty `lastName`) now display without a trailing space.
- WR-05 (`fmtStatRoll`): Added inline comment above the `Math.abs(penalty)` call documenting that `attackerPenalty` may be zero or negative (bonus scenario) and that `Math.abs` is intentional display normalization.
- WR-08 (`formatEvent` GOAL case): Changed `isGoal: false` to `isGoal: true`. The GOAL case was the only case that should return `true` but incorrectly returned `false`.

---

### CR-02, WR-07: seed-rosters.ts — header comma validation and count assertion

**Files modified:** `packages/shared/scripts/seed-rosters.ts`
**Commit:** 85a3562
**Applied fix:**

- CR-02: After parsing each CSV header, added a validation loop that throws with a helpful message if any header cell contains a comma. This guards against RFC 4180 quoted-field CSVs silently corrupting all column lookups via the bare `split(',')` parser.
- WR-07: After building `allEntries`, added an assertion `if (allEntries.length !== 178) throw new Error(...)` before writing output. This provides a fail-fast check at generation time rather than relying solely on the post-generation `teams.test.ts` assertion.

---

### CR-03: teamConfig.ts + roomHandlers.ts — O(1) lookup map and try/catch

**Files modified:** `packages/shared/src/teamConfig.ts`, `packages/server/src/roomHandlers.ts`
**Commit:** 228fa38
**Applied fix:**

- `teamConfig.ts`: Added module-level `const PLAYER_POOL_MAP = new Map(PLAYER_POOL.map((p) => [p.id, p]))`. Rewrote `getSquadPlayers` to use `PLAYER_POOL_MAP.get(id)` instead of `PLAYER_POOL.find(...)`. Reduces 11 × 178 = ~1,958 comparisons per team to 11 O(1) Map lookups.
- `roomHandlers.ts`: Wrapped the `buildInitialGameState(...)` call in a try/catch block that logs the error via `console.error`, emits `ServerEvents.GAME_ERROR('SERVER_ERROR')` to the socket, and returns — preventing an uncaught synchronous throw from crashing the Node process inside the Socket.io handler.

---

### WR-02, WR-04: gameEngine.ts — diagnostic log and activeTeam comment

**Files modified:** `packages/server/src/gameEngine.ts`
**Commit:** f2a298a
**Applied fix:**

- WR-02 (`buildSquadPieces`): Refactored the `if (homeST && awayST)` block to `if (!homeST || !awayST) { console.error(...) } else { ...positioning... }`. The error log includes which team's ST is missing and `selectedTeams` context. Game proceeds unchanged (ball at centre, no carrier until pickup) but the diagnostic is now emitted.
- WR-04 (`applyStartMovement`): Added a comment block in the JSDoc explaining that the `activeTeam` validation is intentionally deferred to the handler layer (T-4-05) as a deliberate architectural decision — the engine is a pure state-transition function, not an authorization boundary.

---

### WR-03: TeamSelectionScreen.tsx — compute selectedOption once

**Files modified:** `packages/client/src/components/TeamSelectionScreen.tsx`
**Commit:** ca7261d
**Applied fix:** Added `const selectedOption = SPEED_OPTIONS.find((o) => o.value === selectedSpeed)` before the return statement. Replaced the three repeated `.find(...)` calls in the visitor branch with `selectedOption?.colorClass`, `selectedOption?.icon`, and `selectedOption?.label ?? selectedSpeed`.

---

### WR-06: mockMovementState.ts — document annotation strategy

**Files modified:** `packages/client/src/mock/mockMovementState.ts`
**Commit:** 3591c80
**Applied fix:** Added a comment above the `export const mockMovementState: GameState` declaration explaining why `satisfies GameState` cannot be used here. The `: GameState` annotation already catches missing required fields at compile time. Using `satisfies` would narrow `typeof mockMovementState` to the literal object shape, breaking tests that use `Partial<typeof mockMovementState>` as an overrides type (e.g. `FreeKickSetupPanel.test.tsx` adds `freeKickHex`, `freeKickStageIndex` etc. via overrides — fields that exist in `GameState` but not in the base mock object).

Note: TypeScript verification confirmed the `: GameState` annotation is sufficient — `npx tsc --noEmit -p packages/client/tsconfig.json` passes with zero errors.

---

## Test Suite Result

All tests pass after fixes:

- `packages/shared`: 359 tests, 12 test files — all passed
- `packages/server`: 490 tests (1 skipped, pre-existing), 23 test files — all passed
- `packages/client`: 249 tests, 13 test files — all passed

---

_Fixed: 2026-07-03T18:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
