---
phase: 11-rule-correctness
fixed_at: 2026-06-11T00:00:00Z
fix_scope: critical_warning
findings_in_scope: 8
fixed: 8
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed:** 2026-06-11T00:00:00Z
**Fix Scope:** critical_warning (Critical + Warning)
**Findings in scope:** 8
**Fixed:** 8
**Skipped:** 0
**Status:** all_fixed

## Applied Fixes

### CR-01 ✓ — `TESTING_PACE_OVERRIDE` disabled

**Commit:** `fix(11): CR-01 disable TESTING_PACE_OVERRIDE — set to null for production`

Removed the testing comment and set the constant to `null`. The `??` fallback in `applyRoll` now reads `piece.pace` for all pieces, restoring correct movement balance.

```ts
// Before
/** TESTING ONLY — set to null to use real piece pace values. Remove before ship. */
const TESTING_PACE_OVERRIDE: number | null = 15;

// After
const TESTING_PACE_OVERRIDE: number | null = null;
```

---

### CR-02 ✓ — Header tie deadlock resolved

**Commit:** `fix(11): CR-02 header tie resolves to LOOSE_BALL immediately (no deadlock)`

Inside the `bothConfirmed` block in `GAME_HEADER_CONTESTANT`, a `winner === null` check now immediately transitions to `LOOSE_BALL` and clears all header state fields instead of storing `null` in `headerDuelWinner` and leaving the game stuck.

---

### WR-01 ✓ — Accuracy acknowledgment message

**Commit:** `fix(11): WR-01..06 — accuracy label, snap-back, console.log, header routing, duel score parity, lastShotPath`

Changed `"pass is accurate! Click to continue."` → `"accurate! Click to continue."` — removes the hardcoded outcome text that was coincidentally correct but fragile.

---

### WR-02 ✓ — `GAME_SNAPSHOT` null-state snap-back

**Commit:** (same combined commit)

Added `broadcastState(io, room)` to the null-state early return in `GAME_SNAPSHOT` to match the ARCH-04 snap-back pattern applied on all other rejection paths.

---

### WR-03 ✓ — Production `console.log` calls removed

**Commit:** (same combined commit)

Removed all 9 `console.log` statements from `gameHandlers.ts`:

- 4 in the `SNAP_DEFLECT` path (deflection check block, DEFLECTED, GK out of range, GK in range)
- 3 in the `GAME_SHOT` path (deflection check block, DEFLECTED, GK out of range)
- 2 in the `GK_DIVE` path (shot dice, shot outcome)

Also removed the now-empty `if (snapDefInputs.length > 0)` and `if (defInputs.length > 0)` wrapper blocks.

---

### WR-04 ✓ — Header goal-line routing uses duel winner's team

**Commit:** (same combined commit)

`applyResolveHeaderTarget` now uses `state.headerDuelWinner ?? state.attackingTeam` to determine `attackingTeamForHeader`, ensuring that a defending team win routes the headed ball toward the correct goal (`q=0` for away winners, `q=36` for home winners).

---

### WR-05 ✓ — `applyRoll` HEADER branch aligned with `computeHeaderDuelWinner`

**Commit:** (same combined commit)

Changed the `buildResults` inner function inside `applyRoll`'s HEADER case from:

```ts
return { piece, die, raw: piece.heading + die };
```

to:

```ts
return { piece, die, raw: computeCombinedScore(piece.heading, die, []) };
```

Both the `applyRoll` HEADER path and `computeHeaderDuelWinner` now use the same scoring function, eliminating the latent divergence that could produce different duel rankings for identical dice inputs.

---

### WR-06 ✓ — `lastShotPath: null` in inaccurate GK kick branch

**Commit:** (same combined commit)

Added `lastShotPath: null` to the inaccurate GK kick state spread in `GK_KICK_MOVEMENT`. A stale `lastShotPath` from a prior shot could previously persist on screen after an inaccurate kick.

---

## Info Findings (not in fix scope)

- **IN-01**: `useGameStore.ts` initialises with `mockMovementState` in production — deferred
- **IN-02**: Distance-7 boundary test vacuous assertion — deferred
- **IN-03**: "Pitfall 2" comment should say "Pitfall 5" — deferred

---

_Fixed: 2026-06-11T00:00:00Z_
_Fixer: Claude (gsd-code-fixer via orchestrator)_
