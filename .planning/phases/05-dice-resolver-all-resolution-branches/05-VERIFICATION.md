---
phase: 05-dice-resolver-all-resolution-branches
verified: 2026-05-30T17:45:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/14
  gaps_closed:
    - "A tied shot duel transitions to LOOSE_BALL (game phase) — gameEngine.ts SHOT branch now sets phase:'LOOSE_BALL' with ball at incident hex"
    - "Movement transitions to MOVEMENT with attackingTeam set to the GK's team (resulting MOVEMENT phase is usable) — all four applyGKRestart branches now set movementSlot:'ATTACKER_4', movedPieceIds:[], paceUsedByPieceId:{}"
    - "Loose Ball direction/distance dice reuse in PASS inaccurate and HEADER tie branches — both now set phase:'LOOSE_BALL' with ball at incident hex; fresh dice resolved on the next game:roll"
  gaps_remaining: []
  regressions: []
---

# Phase 5: Dice Resolver + All Resolution Branches Verification Report

**Phase Goal:** All stochastic resolution paths — pass accuracy, shot/save duels, heading duels, Loose Ball, and GK restart — use server-side cryptographic dice and produce correct outcomes broadcast to both clients.
**Verified:** 2026-05-30T17:45:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 04 fixed three bugs)

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                            | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PlayerPiece type has a highPass attribute; GKs are 0, outfielders are non-zero                                                                   | VERIFIED | types.ts: `highPass: number` on PlayerPiece; teams.ts: GK=0, DEF=4, MID=6, FWD=5 across all 22 players                                                                                                                                                                                                                                                                                                                       |
| 2   | GameState type has a lastDiceRoll field (rolls + context) the server can populate                                                                | VERIFIED | types.ts: `lastDiceRoll?: { rolls: number[]; context: string } \| null`                                                                                                                                                                                                                                                                                                                                                      |
| 3   | GAME_GK_RESTART client event exists and is typed with a kick/throw/movement payload                                                              | VERIFIED | events.ts: `GAME_GK_RESTART: 'game:gk-restart'` in ClientEvents; `(choice: 'kick' \| 'throw' \| 'movement') => void` in ClientToServerEvents                                                                                                                                                                                                                                                                                 |
| 4   | High Pass accuracy uses the highPass attribute, not aerialAbility                                                                                | VERIFIED | passValidator.ts line 143: `const attribute = passType === 'HIGH' ? piece.highPass : piece.dribbling`                                                                                                                                                                                                                                                                                                                        |
| 5   | A tied shot duel resolves to LOOSE_BALL, not SAVE (validator level)                                                                              | VERIFIED | shotValidator.ts: `if (shooterScore === gkScore) return { outcome: 'LOOSE_BALL' }`                                                                                                                                                                                                                                                                                                                                           |
| 6   | packages/shared compiles and its full test suite passes                                                                                          | VERIFIED | 130 passed, 0 failed                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | All dice come from crypto.randomInt via rollDice(); stubDice() no longer exists                                                                  | VERIFIED | diceUtils.ts uses `randomInt(1,7)`; 0 matches for `stubDice` and `Math.random` in server/src                                                                                                                                                                                                                                                                                                                                 |
| 8   | A game:roll event from the active player rolls dice, applies phase-correct resolution, and broadcasts one game:state with lastDiceRoll populated | VERIFIED | gameHandlers.ts: GAME_ROLL handler pre-generates d1/d2/d3 via rollDice(), calls applyRoll, calls broadcastState; integration test confirms lastDiceRoll is populated                                                                                                                                                                                                                                                         |
| 9   | PASS, SHOT, HEADER, and LOOSE_BALL phases each route to a correct apply\* branch                                                                 | VERIFIED | applyRoll switch covers all four cases with explicit default WRONG_PHASE                                                                                                                                                                                                                                                                                                                                                     |
| 10  | A tied shot duel transitions to LOOSE_BALL (game phase); a save with caught ball transitions to GK_RESTART                                       | VERIFIED | gameEngine.ts lines 513-524: `shotResult.outcome === 'LOOSE_BALL'` branch sets `phase: 'LOOSE_BALL'` with `ball: { position: state.ball.position, carrierId: null }`. SAVE+CAUGHT still transitions to GK_RESTART (line 548-556). Test at gameEngine.test.ts line 557 asserts `result.state.phase === 'LOOSE_BALL'` and `ball.position` unchanged — PASSES in live run.                                                      |
| 11  | game:roll in a non-dice phase or from the wrong team is rejected with game:error and a snap-back broadcast                                       | VERIFIED | DICE_PHASES set; phase guard + team guard in gameHandlers.ts; integration tests confirm WRONG_PHASE and WRONG_TEAM rejections                                                                                                                                                                                                                                                                                                |
| 12  | packages/server compiles and its full test suite passes                                                                                          | VERIFIED | 84 passed, 1 todo, 0 failed; `pnpm -r build` succeeds                                                                                                                                                                                                                                                                                                                                                                        |
| 13  | After a GK catch (phase GK_RESTART), the GK's team can choose kick, throw, or movement; all choices resolve correctly                            | VERIFIED | applyGKRestart handles all three choices; game:gk-restart handler has controlsGKTeam guard, phase guard, payload validation; integration tests cover movement success, WRONG_TEAM, INVALID_CHOICE                                                                                                                                                                                                                            |
| 14  | Movement transitions to MOVEMENT with attackingTeam set to the GK's team (resulting MOVEMENT phase is usable)                                    | VERIFIED | All four applyGKRestart branches (movement, throw, kick-accurate, kick-inaccurate) now set `movementSlot: 'ATTACKER_4'`, `movedPieceIds: []`, `paceUsedByPieceId: {}`. Regression test at gameEngine.test.ts line 807 calls applyMove on post-restart state and asserts result.reason is NOT 'WRONG_SLOT'. Integration test at game.integration.test.ts line 494 asserts `newState.movementSlot === 'ATTACKER_4'`. All pass. |

**Score: 14/14 truths verified**

---

### Required Artifacts

| Artifact                                                 | Expected                                                                                           | Status   | Details                                                                                                                                                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/types.ts`                           | highPass on PlayerPiece, lastDiceRoll on GameState                                                 | VERIFIED | Both fields present and correctly typed                                                                                                                                                                        |
| `packages/shared/src/events.ts`                          | GAME_GK_RESTART event + typed payload                                                              | VERIFIED | Const and interface both present                                                                                                                                                                               |
| `packages/shared/src/teams.ts`                           | highPass values on all 22 players                                                                  | VERIFIED | 22 occurrences confirmed by previous grep                                                                                                                                                                      |
| `packages/shared/src/passValidator.ts`                   | D-14 highPass fix in validatePassAccuracy                                                          | VERIFIED | `piece.highPass` at attribute selection for HIGH pass                                                                                                                                                          |
| `packages/shared/src/shotValidator.ts`                   | D-13/D-17 LOOSE_BALL tie outcome                                                                   | VERIFIED | ShotDuelResult union includes LOOSE_BALL; tie branch at line 71                                                                                                                                                |
| `packages/server/src/diceUtils.ts`                       | rollDice() crypto wrapper                                                                          | VERIFIED | Exists; imports randomInt from 'crypto'                                                                                                                                                                        |
| `packages/server/src/gameEngine.ts`                      | applyRoll dispatcher + resolution branches; applyGKRestart with movementSlot on all MOVEMENT paths | VERIFIED | applyRoll has 4 branches + default; applyGKRestart has 4 MOVEMENT-returning paths all with movementSlot:'ATTACKER_4'; 10 total occurrences of `movementSlot: 'ATTACKER_4'`                                     |
| `packages/server/src/gameHandlers.ts`                    | game:roll handler + game:gk-restart handler                                                        | VERIFIED | Both handlers present with isProcessing mutex                                                                                                                                                                  |
| `packages/server/src/__tests__/gameEngine.test.ts`       | Updated assertions for fixed branches + regression test                                            | VERIFIED | SHOT tie asserts LOOSE_BALL phase; PASS inaccurate asserts ball.position unchanged + rolls:[1]; HEADER tie asserts LOOSE_BALL; all 4 applyGKRestart success tests assert movementSlot; regression test present |
| `packages/server/src/__tests__/game.integration.test.ts` | movementSlot assertion on GK restart wire test                                                     | VERIFIED | Line 494: `expect(newState.movementSlot).toBe('ATTACKER_4')`                                                                                                                                                   |

---

### Key Link Verification

| From                                              | To                                                         | Via                                                | Status   | Details                                                                                                            |
| ------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| passValidator.ts                                  | PlayerPiece.highPass                                       | `passType === 'HIGH' ? piece.highPass`             | VERIFIED | Line 143 matches plan pattern                                                                                      |
| shotValidator.ts                                  | ShotDuelResult LOOSE_BALL                                  | `shooterScore === gkScore`                         | VERIFIED | Tie branch returns LOOSE_BALL                                                                                      |
| gameHandlers.ts                                   | applyRoll                                                  | `applyRoll(room.gameState, d1, d2, d3)`            | VERIFIED | Handler pre-generates dice then calls applyRoll                                                                    |
| gameEngine.ts                                     | validateShotDuel / validatePassAccuracy / computeLooseBall | branch dispatch by state.phase                     | VERIFIED | Switch cases call all validators                                                                                   |
| gameHandlers.ts                                   | broadcastState                                             | single broadcast after every resolution            | VERIFIED | Single `broadcastState(io, room)` in success path                                                                  |
| gameHandlers.ts (GK restart)                      | applyGKRestart                                             | `applyGKRestart(room.gameState, choice, rollDice)` | VERIFIED | Handler dispatches with injected rollDice                                                                          |
| gameHandlers.ts                                   | ball.carrierId GK piece via controlsGKTeam                 | `controlsGKTeam` helper                            | VERIFIED | 3 occurrences: definition + guard uses                                                                             |
| applyGKRestart MOVEMENT paths                     | applyMove slot guard                                       | `movementSlot: 'ATTACKER_4'` set in returned state | VERIFIED | All 4 MOVEMENT-returning branches in applyGKRestart include the field; applyMove no longer rejects with WRONG_SLOT |
| applyRoll SHOT tie / PASS inaccurate / HEADER tie | LOOSE_BALL phase                                           | `phase: 'LOOSE_BALL'` with ball at incident hex    | VERIFIED | Three branches now set LOOSE_BALL; landing deferred to next game:roll                                              |

---

### Data-Flow Trace (Level 4)

| Artifact                       | Data Variable                         | Source                                     | Produces Real Data | Status  |
| ------------------------------ | ------------------------------------- | ------------------------------------------ | ------------------ | ------- |
| gameHandlers.ts GAME_ROLL      | d1, d2, d3                            | rollDice() → crypto.randomInt(1,7)         | Yes                | FLOWING |
| gameEngine.ts applyRoll        | lastDiceRoll                          | Constructed from pre-generated dice        | Yes                | FLOWING |
| gameEngine.ts applyGKRestart   | kickDice, directionDice, distanceDice | injected rollDie() → rollDice() in handler | Yes                | FLOWING |
| gameHandlers.ts broadcastState | room.gameState                        | result.state from applyRoll/applyGKRestart | Yes                | FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                                                             | Command                                                                                       | Result                                                                                 | Status |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| shared test suite (130 tests)                                                        | pnpm --filter @counter-attack/shared test                                                     | 130 passed, 0 failed                                                                   | PASS   |
| server test suite (84 tests)                                                         | pnpm --filter @counter-attack/server test                                                     | 84 passed, 1 todo, 0 failed                                                            | PASS   |
| Full repo build                                                                      | pnpm -r build                                                                                 | All packages built successfully                                                        | PASS   |
| stubDice absent from gameEngine.ts                                                   | grep stubDice                                                                                 | 0 matches                                                                              | PASS   |
| Math.random absent from server/src                                                   | grep Math.random                                                                              | 0 matches                                                                              | PASS   |
| SHOT tie → LOOSE_BALL phase                                                          | gameEngine.ts line 520: `phase: 'LOOSE_BALL'`; test line 564 asserts `phase === 'LOOSE_BALL'` | Confirmed by live test run                                                             | PASS   |
| PASS inaccurate → LOOSE_BALL phase, ball.position unchanged                          | gameEngine.ts line 463; test line 523 asserts position equals passState.ball.position         | Confirmed by live test run                                                             | PASS   |
| HEADER tie → LOOSE_BALL phase, ball.position unchanged                               | gameEngine.ts line 741; test line 629 asserts phase === 'LOOSE_BALL'                          | Confirmed by live test run                                                             | PASS   |
| applyGKRestart sets movementSlot:'ATTACKER_4' on all branches                        | gameEngine.ts lines 851, 873, 897, 920                                                        | 10 total occurrences of movementSlot:'ATTACKER_4' in gameEngine.ts                     | PASS   |
| Post-restart applyMove not rejected WRONG_SLOT                                       | regression test line 807-824                                                                  | applyMove result.reason !== 'WRONG_SLOT'                                               | PASS   |
| Integration: GK restart movement → movementSlot:'ATTACKER_4'                         | game.integration.test.ts line 494                                                             | Asserted and passing                                                                   | PASS   |
| computeLooseBall call sites (no biased-dice inline calls remain in SHOT/PASS/HEADER) | grep computeLooseBall gameEngine.ts                                                           | 3 call sites: LOOSE_BALL case + SAVE+SPILL + GK kick inaccurate (all 3 are legitimate) | PASS   |

---

### Probe Execution

No probe scripts declared in plan. Step 7c: SKIPPED (no probe-\*.sh files for this phase).

---

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                         | Status    | Evidence                                                                                                                                                                                                                          |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DICE-01     | 05-01, 05-02 | All dice rolls generated server-side using cryptographically random source                          | SATISFIED | diceUtils.ts uses crypto.randomInt; Math.random=0 in server/src; no dice generation in packages/client                                                                                                                            |
| DICE-02     | 05-02        | Active player clicks "Roll" button to trigger roll; result broadcast to both clients simultaneously | SATISFIED | game:roll handler exists; broadcastState(io, room) broadcasts to all room members; integration test confirms both clients receive state                                                                                           |
| SHOT-05     | 05-03, 05-04 | After GK catches ball, they choose kick/throw/start Movement Phase                                  | SATISFIED | GK_RESTART phase entered correctly; all three choices handled; resulting MOVEMENT phase is now fully functional — movementSlot:'ATTACKER_4' set on all four branches; regression test confirms applyMove is accepted post-restart |

---

### Anti-Patterns Found

| File                              | Line | Pattern                                                                                          | Severity | Impact                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | ---- | ------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| packages/server/src/gameEngine.ts | 559  | SHOT SAVE+SPILL uses shooterDice (d1) and gkDice (d2) as loose-ball dice — reuses shot duel dice | Info     | Not listed in prior verification gaps; plan action explicitly prohibited changing this branch; shot-duel dice are pre-generated uniformly and not constrained by a prior roll outcome in the same way accuracy/tie dice are. Minor inconsistency noted in 05-04-SUMMARY.md as a known non-blocking discrepancy. |
| packages/server/src/gameEngine.ts | —    | applyUndo missing movedPieceIds restore (CR-03 from REVIEW)                                      | Info     | Phase 4 bug surfaced during Phase 5 review; UNDO-01..04 are Phase 7 scope. Not a Phase 5 deliverable.                                                                                                                                                                                                           |

No TBD/FIXME/XXX debt markers found in modified files.

---

### Human Verification Required

None — all truths are verifiable in code. Failures from the prior verification are now resolved in the codebase and confirmed by the live test suite.

---

## Re-verification: Gap Status

### Gaps Closed

**Gap 1 — GK restart produces non-functional MOVEMENT phase (was BLOCKER → CLOSED)**

All four applyGKRestart branches (movement, throw, kick-accurate, kick-inaccurate) now set `movementSlot: 'ATTACKER_4'`, `movedPieceIds: []`, and `paceUsedByPieceId: {}`. The regression test at gameEngine.test.ts line 807 confirms applyMove on post-restart state does NOT return `WRONG_SLOT`. The integration test at line 494 asserts `newState.movementSlot === 'ATTACKER_4'` over the wire. SHOT-05 is now SATISFIED.

**Gap 2 — SHOT tie transitions to MOVEMENT not LOOSE_BALL phase (was BLOCKER → CLOSED)**

The SHOT LOOSE_BALL branch (lines 513-524) removes the inline `computeLooseBall` call and sets `phase: 'LOOSE_BALL'` with `ball: { position: state.ball.position, carrierId: null }`. The unit test at gameEngine.test.ts line 557-569 asserts `phase === 'LOOSE_BALL'` and `ball.position` unchanged — passing in live run.

**Gap 3 — Biased Loose Ball dice in PASS inaccurate and HEADER tie branches (was WARNING → CLOSED)**

The PASS inaccurate branch (lines 455-468) removes the inline `computeLooseBall` call, keeps `phase: 'LOOSE_BALL'`, sets `ball: { position: state.ball.position, carrierId: null }`, and only includes the accuracy die d1 in `lastDiceRoll.rolls`. The HEADER tie branch (lines 735-745) similarly removes inline `computeLooseBall` and sets `phase: 'LOOSE_BALL'` with ball at incident hex. Fresh independent dice are resolved on the subsequent game:roll via the LOOSE_BALL case.

### Gaps Remaining

None.

### Regressions

None — the prior 82 server tests still pass (now 84 with two new tests added by Plan 04); shared tests unchanged at 130.

---

## Note on Roadmap SC 2

Roadmap Success Criterion 2 says "dice result visible to both players before any outcome is applied." Implementation decision D-10 (locked in 05-CONTEXT.md) explicitly chose a single-broadcast model where dice AND outcome are in one `game:state` emit. The code follows D-10 faithfully. `lastDiceRoll` is embedded in state so players see what was rolled, but the phase has already advanced. This is an intentional design deviation from SC-2's literal wording, documented in CONTEXT.md. Not counted as a code gap since D-10 was a deliberate, documented decision.

---

_Verified: 2026-05-30T17:45:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Plan 04 gap closure confirmed_
