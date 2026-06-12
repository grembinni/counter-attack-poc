---
phase: 11-rule-correctness
fixed_at: 2026-06-12T02:15:00Z
review_path: .planning/phases/11-rule-correctness/11-REVIEW.md
iteration: 2
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-06-12T02:15:00Z
**Source review:** .planning/phases/11-rule-correctness/11-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: `computeHeaderDuelWinner` applies validateHeading distance penalty

**Files modified:** `packages/server/src/gameEngine.ts`
**Commit:** 395a963
**Applied fix:** Replaced the raw `attackerWinner.raw` / `defenderWinner.raw` comparison with a penalty-aware comparison. Added a `validateHeading` call after both contestants are resolved to obtain the HEAD-01 distance `penaltyMod`, then recomputed the attacker score via `computeCombinedScore(attackerWinner.piece.heading, attackerWinner.die, [penaltyMod])`. The defender score is recomputed via `computeCombinedScore(defenderWinner.piece.heading, defenderWinner.die, [])`. This mirrors the logic in `applyRoll`'s HEADER branch (lines 1543-1552) so both paths agree on contested duel outcomes.

---

### CR-02: `applyResolveHeaderTarget` picks highest-heading contestant not `[0]`

**Files modified:** `packages/server/src/gameEngine.ts`
**Commit:** 0e16f85
**Applied fix:** Replaced `const winnerContestantId = winnerContestantIds[0]` with a `reduce` that iterates all contestant IDs and picks the one with the highest `heading` attribute. This matches the `pickWinner` logic in `computeHeaderDuelWinner` so the same piece that won the intra-team tiebreak is used as the reference position for the 6-hex range guard, the GK_DIVING ball origin, and the PASS ball carrier.

---

### CR-03: `applyResolveHeaderTarget` uses `winnerTeam` for goal direction

**Files modified:** `packages/server/src/gameEngine.ts`
**Commit:** 9d31c29
**Applied fix:** Replaced `const attackingTeamForHeader = state.headerDuelWinner ?? state.attackingTeam` with direct use of the already-captured `winnerTeam` variable (set from `state.headerDuelWinner` before `headerCleared` is constructed). Removed the intermediate `attackingTeamForHeader` variable and updated `goalQ` and `defenderTeamForGk` to use `winnerTeam` directly. This prevents the `?? state.attackingTeam` fallback from activating if `headerDuelWinner` were ever null at that point, and makes the intent explicit.

Note: this finding was classified as a logic error. **Requires human verification** to confirm goal-line routing is correct for defender-win headers.

---

### WR-01: Clear `lastShotPath` on accurate GK kick PASS transition

**Files modified:** `packages/server/src/gameHandlers.ts`
**Commit:** 07d7429
**Applied fix:** Added `lastShotPath: null` to the accurate GK kick result spread (PASS transition at line 638). The inaccurate LOOSE_BALL branch already had this field. Without the fix, a stale `lastShotPath` from a prior shot in the same possession would persist and render golden shot-path hexes during the PASS phase.

---

### WR-02: Add off-pitch and occupancy guards to `GAME_KICK_OFF_MOVE`

**Files modified:** `packages/server/src/gameHandlers.ts`
**Commit:** 3f7d1f1
**Applied fix:** Added two guards before the free repositioning is applied: (1) a pitch-boundary check using `PITCH_HEXES.some(...)` that emits `GAME_ERROR: OFF_PITCH` and returns; (2) an occupancy check using `pieces.some(...)` that emits `GAME_ERROR: OCCUPIED` and returns. Both guards call `broadcastState` for snap-back. Pattern matches existing `GAME_MOVE` and `GAME_SHOT` handlers which already use `PITCH_HEXES` (imported at line 33).

---

### WR-03: Block GAME_ROLL re-fire after `headerDuelWinner` already resolved

**Files modified:** `packages/server/src/gameHandlers.ts`
**Commit:** d8e84f6
**Applied fix:** Added an explicit guard after the existing `HEADER_NOT_CONFIRMED` check: if `phase === 'HEADER' && headerDuelWinner !== undefined`, emit `GAME_ERROR: DUEL_ALREADY_RESOLVED` and return. This prevents a losing attacker from sending GAME_ROLL to re-roll the duel after it was auto-fired in `GAME_HEADER_CONTESTANT`.

---

### WR-04: Add idempotency guard to `GAME_HEADER_ACCURACY_ACK`

**Files modified:** `packages/server/src/gameHandlers.ts`
**Commit:** f3ba60a
**Applied fix:** Added a flag-presence check after the team guard: if `!room.gameState.headerAccuracyRollPending`, call `broadcastState` (snap-back) and return without mutating state. This prevents a double-ACK (network retry or malicious re-send) from triggering a spurious state broadcast during the contestant-selection window that could wipe `gameError` or other client-side fields.

---

### WR-05: Deprecate `applyDeclareHeaderTarget` superseded by `applyResolveHeaderTarget`

**Files modified:** `packages/server/src/gameEngine.ts`
**Commit:** f7ad71f
**Applied fix:** Added `@deprecated` JSDoc comments to both `ApplyDeclareHeaderTargetResult` and `applyDeclareHeaderTarget` pointing to their replacements. The function still exists because `gameEngine.phase10.test.ts` imports and tests it via `describe.skip` blocks; removing it would break the import. The deprecation comment explains the supersession and directs future contributors to `applyResolveHeaderTarget`.

---

_Fixed: 2026-06-12T02:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
