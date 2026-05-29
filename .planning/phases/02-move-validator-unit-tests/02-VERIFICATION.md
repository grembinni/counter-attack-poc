---
phase: 02-move-validator-unit-tests
verified: 2026-05-29T17:01:28Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Verify Loose Ball direction mapping against physical Counter Attack rulebook v1.4.1 deflection ruler"
    expected: "Direction dice 1=E, 2=NE, 3=NW, 4=W, 5=SW, 6=SE matches the printed ruler"
    why_human: "The mapping is hard-coded in scoreUtils.ts with source comment. No digital rulebook is available for programmatic verification. The CONTEXT.md Deferred section and 02-VALIDATION.md Manual-Only section both flag this as requiring physical rulebook inspection before Phase 4 live use."
  - test: "Verify pass attribute mapping: High Pass uses aerialAbility, Long Pass uses dribbling"
    expected: "Confirmed against Counter Attack rulebook that aerialAbility drives High Pass accuracy threshold (8+) and dribbling drives Long Pass accuracy threshold (9+/10+)"
    why_human: "The mapping is documented as assumption A1 in passValidator.ts and 02-RESEARCH.md. Two TODO markers reference this. The 02-VALIDATION.md Manual-Only section flags it as requiring physical rulebook check before Phase 4 live use."
---

# Phase 2: Move Validator + Unit Tests Verification Report

**Phase Goal:** All game rule validation logic — movement, passing, heading, shooting, snapshots, Zone of Influence, and Loose Ball — exists as pure functions in `packages/shared` with a passing unit test suite.
**Verified:** 2026-05-29T17:01:28Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                    | Status     | Evidence                                                                                         |
|----|------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------------|
| 1  | Test runner executes 20+ tests covering all rule domains — all pass                      | VERIFIED   | `pnpm --filter=@counter-attack/shared exec vitest run` → 95 tests pass across 7 test files       |
| 2  | `validateMove()` rejects occupied hexes and Pace-busting moves; accepts legal moves      | VERIFIED   | moveValidator.ts implements all five guard conditions; 12 tests pass confirming all paths         |
| 3  | `validatePass()` enforces correct distance caps for all four pass types                  | VERIFIED   | passValidator.ts: STANDARD 11, FIRST_TIME 6, HIGH 15, LONG unlimited; 21 tests pass              |
| 4  | ZoI utilities return correct adjacent-hex data and ball-carrier influence detection       | VERIFIED   | `getZoIDefenders` and `isUnderZoI` in hex.ts; 4 getZoIDefenders tests + 3 isUnderZoI tests pass  |
| 5  | All validation functions have zero socket.io/express imports — build passes in isolation | VERIFIED   | `pnpm --filter=@counter-attack/shared build` exits 0 with no output (clean TypeScript compile)   |

**Score:** 5/5 truths verified

---

### Note on ROADMAP SC-4 terminology (`computeZoI`)

The ROADMAP success criterion #4 names `computeZoI()`, which does not exist as a function. The Phase 2 implementation uses two functions that together satisfy this criterion: `getZoIDefenders(position, opponents): PlayerPiece[]` (typed variant returning the full defender list for consequence data) and `isUnderZoI(position, opponentHexes): boolean` (boolean check retained for backward compatibility). Both are exported from `index.ts`. The ROADMAP wording names a function that was renamed/split during planning — the CONTEXT.md and PLAN frontmatter both use `getZoIDefenders` as the canonical name. This is a naming drift in the ROADMAP, not a missing function.

---

### Required Artifacts

| Artifact                                  | Expected                                              | Status     | Details                                                                                  |
|-------------------------------------------|-------------------------------------------------------|------------|------------------------------------------------------------------------------------------|
| `packages/shared/src/types.ts`            | GameState + D-08 fields                               | VERIFIED   | `movedPieceIds`, `paceUsedByPieceId`, `movementSlot` all present with full JSDoc          |
| `packages/shared/src/hex.ts`              | `hexLine` and `getZoIDefenders` added                 | VERIFIED   | Both functions exported; algorithm sourced and commented                                  |
| `packages/shared/src/scoreUtils.ts`       | `computeCombinedScore` and `computeLooseBall`         | VERIFIED   | Both functions exported; DICE-04 cap via `Math.max(totalPenalty, -2)` is single source   |
| `packages/shared/src/moveValidator.ts`    | `validateMove` returning `MoveResult`                 | VERIFIED   | Discriminated union type; all 5 reject reasons + 3 accept paths; no throws               |
| `packages/shared/src/passValidator.ts`    | `validatePass` + `validatePassAccuracy`               | VERIFIED   | Both exported; discriminated unions; 4 pass types; PASS-04 landing logic present          |
| `packages/shared/src/shotValidator.ts`    | `validateShotDuel`, `validateGKDive`, `validateHandlingCheck`, `getOutsideAreaModifiers` | VERIFIED | All four exported; discriminated unions; no throws                        |
| `packages/shared/src/headingValidator.ts` | `validateHeading` returning `HeadingResult`           | VERIFIED   | Discriminated union; HEAD-04 checked before geometry; HEAD-05 excludedPieceIds present   |
| `packages/shared/src/snapshotValidator.ts`| `validateSnapshot` returning `SnapshotResult`         | VERIFIED   | Discriminated union; SNAP-01 phase gate; SNAP-02 penalty and deflection effect in result  |
| `packages/shared/src/index.ts`            | Barrel re-exports all Phase 2 modules                 | VERIFIED   | All 6 Phase 2 export lines present (scoreUtils + 5 validators)                            |
| `packages/shared/src/hex.test.ts`         | Tests for hexLine and getZoIDefenders                 | VERIFIED   | 5 hexLine tests + 4 getZoIDefenders tests present and passing                            |
| `packages/shared/src/scoreUtils.test.ts`  | Tests for computeCombinedScore and computeLooseBall   | VERIFIED   | 6 + 8 = 14 tests passing                                                                 |
| `packages/shared/src/moveValidator.test.ts`   | 10+ tests for validateMove                        | VERIFIED   | 12 tests covering all guard paths and ZoI steal trigger                                  |
| `packages/shared/src/passValidator.test.ts`   | 15+ tests for validatePass and validatePassAccuracy | VERIFIED | 21 tests covering all pass types, path blocking, landing constraints, DICE-04 cap        |
| `packages/shared/src/shotValidator.test.ts`   | Tests for shot duel, dive, handling                | VERIFIED   | 13 tests covering SHOT-03 auto-miss, SHOT-04 dive range, SHOT-06 handling                |
| `packages/shared/src/headingValidator.test.ts`| Tests for heading duel                            | VERIFIED   | 8 tests covering HEAD-01 through HEAD-05; precedence guard tested                        |
| `packages/shared/src/snapshotValidator.test.ts`| Tests for snapshot trigger                       | VERIFIED   | 4 tests covering SNAP-01 phase gate and SNAP-02 result shape                             |

---

### Key Link Verification

| From                       | To                          | Via                               | Status   | Details                                                            |
|----------------------------|-----------------------------|-----------------------------------|----------|--------------------------------------------------------------------|
| `hex.ts`                   | `types.ts`                  | `import type { HexCoord, PlayerPiece }` | WIRED | Line 1 of hex.ts                                                 |
| `scoreUtils.ts`            | `types.ts`                  | `import type { HexCoord }`        | WIRED    | Line 11 of scoreUtils.ts                                           |
| `moveValidator.ts`         | `hex.ts`                    | `import { hexDistance, getZoIDefenders }` | WIRED | Line 16 of moveValidator.ts                                    |
| `passValidator.ts`         | `hex.ts`                    | `import { hexDistance, hexLine, getZoIDefenders }` | WIRED | Line 19 of passValidator.ts                           |
| `passValidator.ts`         | `scoreUtils.ts`             | `import { computeCombinedScore }` | WIRED    | Line 20 of passValidator.ts                                        |
| `shotValidator.ts`         | `scoreUtils.ts`             | `import { computeCombinedScore }` | WIRED    | Line 14 of shotValidator.ts                                        |
| `headingValidator.ts`      | `hex.ts`                    | `import { hexDistance }`          | WIRED    | Line 19 of headingValidator.ts                                     |
| `index.ts`                 | all 6 Phase 2 modules       | `export * from './...js'`         | WIRED    | Lines 8-13 of index.ts confirm all six barrel exports              |

---

### Data-Flow Trace (Level 4)

Not applicable. All Phase 2 artifacts are pure computation functions (no UI components, no API routes, no database queries). Data flows in as parameters, out as typed return values. No rendering or I/O layer exists in this phase.

---

### Behavioral Spot-Checks

| Behavior                                      | Command                                                    | Result                          | Status |
|-----------------------------------------------|------------------------------------------------------------|---------------------------------|--------|
| 95 tests pass in packages/shared              | `pnpm --filter=@counter-attack/shared exec vitest run`    | 7 files, 95 tests, all green    | PASS   |
| Package builds clean (no server imports leak) | `pnpm --filter=@counter-attack/shared build`              | Exit 0, no errors               | PASS   |

---

### Probe Execution

No probes defined for Phase 2 in `scripts/*/tests/probe-*.sh`. Phase 2 is a pure unit-test phase; Vitest is the authoritative probe and was executed directly above.

---

### Requirements Coverage

| Requirement | Description                                                        | Status    | Evidence                                                                      |
|-------------|---------------------------------------------------------------------|-----------|-------------------------------------------------------------------------------|
| MOVE-01     | 4-5-2 sequence (ATTACKER_4 / DEFENDER_5 / ATTACKER_2 slots)        | SATISFIED | `movementSlot` field in GameState; `validateMove` checks slot and enforces caps |
| MOVE-02     | Pace attribute caps movement                                         | SATISFIED | `paceUsedByPieceId` accumulation; ATTACKER_4/5 use `piece.pace` cap           |
| MOVE-03     | Cannot move through/end on occupied hex                             | SATISFIED | OCCUPIED guard at line 65 of moveValidator.ts; test confirms rejection        |
| MOVE-04     | Ball-carrier entering ZoI triggers steal attempt                    | SATISFIED | `getZoIDefenders` called on destination; STEAL_ATTEMPT effect in MoveResult   |
| MOVE-05     | Successful steal ends Movement Phase / transfers possession          | PARTIAL   | Validator signals STEAL_ATTEMPT with defenders list; actual possession transfer and phase-end are Phase 4 FSM responsibilities (intentionally deferred, confirmed in CONTEXT.md Deferred Ideas) |
| MOVE-06     | Free 6-hex move after final-third action                            | DEFERRED  | Documented as deferred to Phase 4 (requires PITCH-02 region encoding); comment in moveValidator.ts line 9 |
| MOVE-07     | Snapshot during movement if ball in opponent's penalty area          | PARTIAL   | Phase 2 returns `{ ok: true }` with no SNAPSHOT_AVAILABLE effect; penalty-area detection deferred to Phase 4 |
| PASS-01     | Standard Pass ≤11 hexes; blocked by pieces in path; interception    | SATISFIED | Distance cap, path-blocking (all pieces), interception list all implemented    |
| PASS-02     | First-time Pass ≤6 hexes; FIRST_TIME_PLAYER_MOVES effect            | SATISFIED | Distance cap enforced; effect present in PassResult; test confirms it          |
| PASS-03     | High Pass ≤15 hexes; accuracy check (aerialAbility + dice ≥ 8)     | SATISFIED | Distance cap; validatePassAccuracy with HIGH threshold 8; test confirms        |
| PASS-04     | Long Pass; landing constraints; accuracy check (9+/10+)             | SATISFIED | LANDING_RESTRICTED guard (within 5 of teammate or adjacent to opponent); LONG_SAME_THIRD/CROSS_THIRD thresholds |
| PASS-05     | Inaccurate passes trigger Loose Ball                                 | SATISFIED | `triggerLooseBall: true` in AccuracyResult when `accurate: false`              |
| HEAD-01     | Distance-based penalty: dist 1=no penalty, dist 2=-1                | SATISFIED | `penaltyModifier = dist === 2 ? -1 : 0` in headingValidator.ts line 83        |
| HEAD-02     | Uncontested header = auto-win                                        | SATISFIED | `{ ok: true, contested: false }` when `otherIds.length === 0`                  |
| HEAD-03     | Headed shot at goal — declared via `aimedAtGoal` option              | SATISFIED | `HeadingOptions.aimedAtGoal` field present; Phase 4 FSM consumes it            |
| HEAD-04     | No two consecutive headed passes                                     | SATISFIED | CONSECUTIVE_HEADER checked before geometry; test verifies precedence           |
| HEAD-05     | Header participants excluded from next Movement Phase                | SATISFIED | `excludedPieceIds` array in HeadingResult for FSM to enforce                  |
| SNAP-01     | Snapshot available in MOVEMENT/PASS/SNAPSHOT phases only             | SATISFIED | WRONG_PHASE guard; 4 tests confirm all three valid phases and one invalid       |
| SNAP-02     | Snapshot: -1 shooting penalty + opponent 2-hex deflection            | SATISFIED | `shootingPenalty: -1` and `deflectionEffect: { type: 'OPPONENT_MOVES', maxHexes: 2 }` |
| SNAP-03     | Standard shooting rules apply to snapshots                           | SATISFIED | Composition pattern: FSM chains validateSnapshot → validateShotDuel            |
| SHOT-01     | Shot duel: Shooting+dice vs Saving+dice; higher attacker = goal      | SATISFIED | computeCombinedScore used for both; strict `>` comparison in validateShotDuel  |
| SHOT-02     | Outside-area: -1 shooting penalty; GK 1-hex move permitted           | SATISFIED | `getOutsideAreaModifiers()` returns `{ shootingPenalty: -1, gkMayMoveOneHex: true }` |
| SHOT-03     | Rolling 1 on shot = auto-miss before attribute calculation           | SATISFIED | `if (shooterDice === 1) return { outcome: 'MISS', reason: 'AUTO_MISS' }` first guard; test confirms |
| SHOT-04     | GK dive ≤3 hexes; 3rd hex = -1 Saving; 4+ = unsavable               | SATISFIED | validateGKDive: distance > 3 → OUT_OF_RANGE; distance === 3 → savingPenalty -1 |
| SHOT-06     | Handling check: roll ≥ Handling = spill (Loose Ball)                 | SATISFIED | validateHandlingCheck: `diceValue >= gk.handling` → `{ caught: false, triggerLooseBall: true }` |
| DICE-03     | Combined score = attribute + dice + clamped penalties                | SATISFIED | computeCombinedScore implements this formula                                    |
| DICE-04     | Maximum cumulative penalty = -2                                      | SATISFIED | `Math.max(totalPenalty, -2)` in computeCombinedScore; 3 tests confirm cap      |
| DICE-05     | Loose Ball: direction die + distance die from incident hex           | SATISFIED | computeLooseBall(from, direction, distance) with LOOSE_BALL_DIRECTIONS table    |
| ARCH-07     | Validation logic in packages/shared only; no socket.io/express imports | SATISFIED | Build passes in isolation; grep confirms zero server package imports in any src file |

---

### Anti-Patterns Found

| File                      | Line | Pattern              | Severity | Impact                                                                                                      |
|---------------------------|------|----------------------|----------|-------------------------------------------------------------------------------------------------------------|
| `passValidator.ts`        | 15   | `TODO: Verify mapping…` | WARNING | Flags that aerialAbility/dribbling attribute mapping for High/Long Pass has not been confirmed against the physical rulebook. Referenced in 02-VALIDATION.md Manual-Only section. No issue number — needs human resolution before Phase 4 |
| `headingValidator.ts`     | 42   | `TODO: Verify head-shot composition…` | WARNING | Flags that the headed-shot composition with FSM needs validation before Phase 4 live use. No issue number |

**Debt-marker gate assessment:** Both markers are `TODO` (warning-level), not `TBD`/`FIXME`/`XXX` (blocker-level). The gate rule requires `TBD`, `FIXME`, or `XXX` to be blockers; `TODO` markers are categorised as warnings. Neither references a formal issue number, which is a quality concern but not a blocker under the defined debt-marker gate. Both are flagged as human verification items below.

---

### Human Verification Required

#### 1. Loose Ball Direction Mapping

**Test:** Open Counter Attack rulebook v1.4.1 and locate the deflection ruler. Compare the dice-1-through-6 direction sequence against the constant `LOOSE_BALL_DIRECTIONS` in `packages/shared/src/scoreUtils.ts` (lines 48-55): 1=E `{q:1,r:0}`, 2=NE `{q:1,r:-1}`, 3=NW `{q:0,r:-1}`, 4=W `{q:-1,r:0}`, 5=SW `{q:-1,r:1}`, 6=SE `{q:0,r:1}`.

**Expected:** The mapping matches the printed deflection ruler exactly.

**Why human:** No digital source for rulebook v1.4.1 is accessible programmatically. The CONTEXT.md Deferred section and 02-VALIDATION.md Manual-Only section both mark this as a physical verification requirement before Phase 4 live use.

---

#### 2. Pass Attribute Mapping (aerialAbility / dribbling)

**Test:** Open the Counter Attack rulebook and verify which player attribute governs High Pass accuracy (expected: aerialAbility) and which governs Long Pass accuracy (expected: dribbling). Cross-reference against the implementation in `packages/shared/src/passValidator.ts` lines 143-145:
```
const attribute = passType === 'HIGH' ? piece.aerialAbility : piece.dribbling;
```

**Expected:** The rulebook confirms aerialAbility for High Pass and dribbling for Long Pass.

**Why human:** This is assumption A1 in the CONTEXT.md decisions and 02-RESEARCH.md. The two `TODO` markers at passValidator.ts:15 and (implicitly) headingValidator.ts:42 reference this. No machine-readable source resolves it. If the mapping is wrong, the accuracy thresholds will silently use the wrong attribute in Phase 5 live resolution.

---

## Gaps Summary

No gaps block the phase goal. All five ROADMAP success criteria are met:

1. 95 unit tests pass (well above the 20+ minimum) covering all rule domains.
2. `validateMove()` correctly rejects occupied hexes and Pace-busting moves.
3. `validatePass()` enforces the correct distance caps for all four pass types.
4. ZoI utilities (`getZoIDefenders`, `isUnderZoI`) correctly identify adjacent defenders.
5. `pnpm --filter=@counter-attack/shared build` exits cleanly — zero server-package imports.

Two items require human resolution before Phase 4 can safely use the validators with live dice:

- The Loose Ball direction table must be verified against the physical rulebook (affects `computeLooseBall`, consumed in Phase 5).
- The aerialAbility/dribbling attribute mapping for pass accuracy must be verified (affects `validatePassAccuracy`, consumed in Phase 5).

Both are explicitly acknowledged in the CONTEXT.md, VALIDATION.md, and the source `TODO` comments. They are deferral gates for Phase 5 resolution, not Phase 3 or Phase 4 FSM wiring.

---

### Code Quality Notes (from 02-REVIEW.md)

The code review file at `.planning/phases/02-move-validator-unit-tests/02-REVIEW.md` documents three critical findings and four warnings. Verifying the actual code against the review findings shows:

- **CR-01 (path blocking only checks opponents):** The review's description does not match the actual code. Line 78-79 of passValidator.ts checks ALL pieces (`state.pieces.some((p) =>` with no team filter), and the test at passValidator.test.ts:82 confirms teammate blocking works. CR-01 was already fixed before the review was written, or the review was written against an earlier draft.
- **CR-02 (interception window includes destination):** The actual code at line 102 uses `slice(1, -1)`, correctly excluding both the passer's hex and the destination. CR-02 does not apply to the current code. The test at passValidator.test.ts:105 confirms this behaviour.
- **CR-03 (heading drops penaltyModifier on uncontested branch):** This is a genuine structural observation. The `penaltyModifier` variable is computed unconditionally but not included in the `{ ok: true, contested: false }` return. Per HEAD-02, uncontested headers require no dice roll so the modifier is mechanically irrelevant for Phase 2. The asymmetry is real and the review's fix suggestions are valid quality improvements, but they do not affect the correctness of any currently-passing test or the Phase 2 goal.
- **WR-01 through WR-04 and IN-01 through IN-03:** Documented as quality improvements for future work. None block the phase goal.

---

_Verified: 2026-05-29T17:01:28Z_
_Verifier: Claude (gsd-verifier)_
