---
phase: 05-dice-resolver-all-resolution-branches
verified: 2026-05-30T12:50:00Z
status: gaps_found
score: 9/14 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Movement transitions to MOVEMENT with attackingTeam set to the GK's team (Plan 03 truth 4)"
    status: failed
    reason: 'All three GK restart branches (kick, throw, movement) transition phase to MOVEMENT and set attackingTeam correctly, but movementSlot is inherited from GK_RESTART state as null. applyMove guard is `phase !== MOVEMENT || movementSlot === null` → WRONG_SLOT. No movement is possible after any GK restart choice. The MOVEMENT phase produced by GK restart is completely non-functional.'
    artifacts:
      - path: 'packages/server/src/gameEngine.ts'
        issue: "applyGKRestart movement/throw/kick branches set phase:'MOVEMENT' without setting movementSlot:'ATTACKER_4'; movementSlot is null from the GK_RESTART spread"
      - path: 'packages/server/src/__tests__/game.integration.test.ts'
        issue: "Integration test only asserts phase === 'MOVEMENT' and attackingTeam — does not attempt a subsequent game:move to detect the WRONG_SLOT failure"
    missing:
      - "All three applyGKRestart branches must add movementSlot: 'ATTACKER_4', movedPieceIds: [], paceUsedByPieceId: {} to the returned state"

  - truth: 'A tied shot duel transitions to LOOSE_BALL; a save with caught ball transitions to GK_RESTART (Plan 02 truth 4)'
    status: partial
    reason: "validateShotDuel correctly returns outcome:'LOOSE_BALL' on tie (D-13 — VERIFIED). The save + caught path correctly transitions to GK_RESTART (VERIFIED). However, in applyRoll SHOT branch, when the LOOSE_BALL outcome fires, the engine immediately computes the landing via computeLooseBall and transitions to phase:'MOVEMENT' — bypassing the LOOSE_BALL game phase entirely. The LOOSE_BALL phase exists in the FSM and in DICE_PHASES, but the SHOT tie path never enters it. The test at gameEngine.test.ts:553-563 is titled 'SHOT tie → LOOSE_BALL (D-13)' but asserts phase === 'MOVEMENT', confirming the phase transition is intentionally wrong. CR-02 in the REVIEW identifies this as a logic error."
    artifacts:
      - path: 'packages/server/src/gameEngine.ts'
        issue: "applyRoll SHOT LOOSE_BALL branch (line 516-532) sets phase:'MOVEMENT' instead of phase:'LOOSE_BALL'; also reuses shooterDice (d1) and gkDice (d2) as direction/distance dice — these dice are biased because they already determined the tie outcome (CR-01 reuse pattern)"
    missing:
      - "SHOT tie path should transition to phase:'LOOSE_BALL' (allowing a subsequent game:roll for Loose Ball direction/distance), OR if single-roll design is intended, document explicitly and align the test comment with the implementation"

  - truth: 'Loose Ball resolution rolls independent direction and distance dice (Roadmap SC 4)'
    status: partial
    reason: 'LOOSE_BALL phase directly called by game:roll correctly uses d1/d2 for direction/distance (VERIFIED). However, when Loose Ball is triggered inside the PASS branch (inaccurate pass) and the HEADER tie branch, the code reuses d1 (the accuracy die or attacker die) as the direction die and d2 as the distance die. These are not independent rolls — d1 in PASS is constrained to low values (accuracy failed because it was low), producing systematically biased Loose Ball direction. CR-01 and CR-04 in the REVIEW identify this as a logic error.'
    artifacts:
      - path: 'packages/server/src/gameEngine.ts'
        issue: 'PASS inaccurate branch (line 457-470): computeLooseBall receives d1 (accuracy die) as direction, d2 as distance — biased because d1 caused the inaccuracy; HEADER tie branch (line 730-744): computeLooseBall receives d1 (attacker die) and d2 (defender die) — these produced the tie, so their values are constrained'
    missing:
      - 'PASS inaccurate and HEADER tie paths should use independent dice for Loose Ball direction/distance (d2 and d3 in PASS, or transition to LOOSE_BALL phase for a separate roll)'
---

# Phase 5: Dice Resolver + All Resolution Branches Verification Report

**Phase Goal:** All stochastic resolution paths — pass accuracy, shot/save duels, heading duels, Loose Ball, and GK restart — use server-side cryptographic dice and produce correct outcomes broadcast to both clients.
**Verified:** 2026-05-30T12:50:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                            | Status   | Evidence                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PlayerPiece type has a highPass attribute; GKs are 0, outfielders are non-zero                                                                   | VERIFIED | types.ts line 22; teams.ts: 22 highPass entries grep-confirmed; GK=0, DEF=4, MID=6, FWD=5                                                                                                                                                                                                                                               |
| 2   | GameState type has a lastDiceRoll field (rolls + context) the server can populate                                                                | VERIFIED | types.ts lines 132-135; lastDiceRoll? field present                                                                                                                                                                                                                                                                                     |
| 3   | GAME_GK_RESTART client event exists and is typed with a kick/throw/movement payload                                                              | VERIFIED | events.ts line 12 (const), line 37 (ClientToServerEvents)                                                                                                                                                                                                                                                                               |
| 4   | High Pass accuracy uses the highPass attribute, not aerialAbility                                                                                | VERIFIED | passValidator.ts line 143: `const attribute = passType === 'HIGH' ? piece.highPass : piece.dribbling`                                                                                                                                                                                                                                   |
| 5   | A tied shot duel resolves to LOOSE_BALL, not SAVE                                                                                                | VERIFIED | shotValidator.ts line 71: `if (shooterScore === gkScore) return { outcome: 'LOOSE_BALL' }`                                                                                                                                                                                                                                              |
| 6   | packages/shared compiles and its full test suite passes                                                                                          | VERIFIED | vitest run: 130 passed, 0 failed                                                                                                                                                                                                                                                                                                        |
| 7   | All dice come from crypto.randomInt via rollDice(); stubDice() no longer exists                                                                  | VERIFIED | diceUtils.ts uses randomInt(1,7); grep for stubDice = 0 matches; grep for Math.random in server/src = 0 matches                                                                                                                                                                                                                         |
| 8   | A game:roll event from the active player rolls dice, applies phase-correct resolution, and broadcasts one game:state with lastDiceRoll populated | VERIFIED | gameHandlers.ts: GAME_ROLL handler pre-generates d1/d2/d3 via rollDice(), calls applyRoll, calls broadcastState; integration test confirms lastDiceRoll is populated                                                                                                                                                                    |
| 9   | PASS, SHOT, HEADER, and LOOSE_BALL phases each route to a correct apply\* branch                                                                 | VERIFIED | applyRoll switch statement covers all four cases plus default WRONG_PHASE                                                                                                                                                                                                                                                               |
| 10  | A tied shot duel transitions to LOOSE_BALL (game phase); a save with caught ball transitions to GK_RESTART                                       | FAILED   | Shot duel validator returns outcome:'LOOSE_BALL' (VERIFIED). However, applyRoll SHOT branch sets phase:'MOVEMENT' (line 527) — not 'LOOSE_BALL'. Bypasses the LOOSE_BALL phase entirely. The GK_RESTART transition on SAVE+CAUGHT is VERIFIED (line 553-559).                                                                           |
| 11  | game:roll in a non-dice phase or from the wrong team is rejected with game:error and a snap-back broadcast                                       | VERIFIED | DICE_PHASES set; phase guard + team guard in gameHandlers.ts; integration tests confirm WRONG_PHASE and WRONG_TEAM rejections                                                                                                                                                                                                           |
| 12  | packages/server compiles and its full test suite passes                                                                                          | VERIFIED | vitest run: 82 passed, 1 todo, 0 failed; pnpm -r build succeeds                                                                                                                                                                                                                                                                         |
| 13  | After a GK catch (phase GK_RESTART), the GK's team can choose kick, throw, or movement; all choices resolve correctly                            | VERIFIED | applyGKRestart handles all three choices; game:gk-restart handler has controlsGKTeam guard, phase guard, payload validation; integration tests cover movement success, WRONG_TEAM, INVALID_CHOICE                                                                                                                                       |
| 14  | Movement transitions to MOVEMENT with attackingTeam set to the GK's team (resulting MOVEMENT phase is usable)                                    | FAILED   | attackingTeam is set correctly. However, all three GK restart branches spread `...state` from GK_RESTART, inheriting movementSlot:null. applyMove guard: `phase !== MOVEMENT \|\| movementSlot === null` → every subsequent game:move is rejected WRONG_SLOT. The MOVEMENT phase produced by GK restart is blocked. (WR-03 from REVIEW) |

**Score: 9/14 truths verified (3 failed, 2 partial collapsed into 2 failed gaps)**

---

### Required Artifacts

| Artifact                               | Expected                                                   | Status                 | Details                                                                            |
| -------------------------------------- | ---------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| `packages/shared/src/types.ts`         | highPass on PlayerPiece, lastDiceRoll on GameState         | VERIFIED               | Both fields present and correctly typed                                            |
| `packages/shared/src/events.ts`        | GAME_GK_RESTART event + typed payload                      | VERIFIED               | Line 12 (const), line 37 (interface)                                               |
| `packages/shared/src/teams.ts`         | highPass values on all 22 players                          | VERIFIED               | 22 occurrences confirmed by grep                                                   |
| `packages/shared/src/passValidator.ts` | D-14 highPass fix in validatePassAccuracy                  | VERIFIED               | Contains `piece.highPass` at attribute selection                                   |
| `packages/shared/src/shotValidator.ts` | D-13/D-17 LOOSE_BALL tie outcome                           | VERIFIED               | ShotDuelResult union includes LOOSE_BALL; line 71 tie branch                       |
| `packages/server/src/diceUtils.ts`     | rollDice() crypto wrapper                                  | VERIFIED               | Exists; imports randomInt from 'crypto'                                            |
| `packages/server/src/gameEngine.ts`    | applyRoll dispatcher + resolution branches; applyGKRestart | VERIFIED (substantive) | applyRoll has 4 branches + default; applyGKRestart has 3 branches; stubDice absent |
| `packages/server/src/gameHandlers.ts`  | game:roll handler + game:gk-restart handler                | VERIFIED               | Both handlers present with isProcessing mutex                                      |

---

### Key Link Verification

| From                         | To                                                         | Via                                                | Status   | Details                                         |
| ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------- | -------- | ----------------------------------------------- |
| passValidator.ts             | PlayerPiece.highPass                                       | `passType === 'HIGH' ? piece.highPass`             | VERIFIED | Line 143 matches plan pattern                   |
| shotValidator.ts             | ShotDuelResult LOOSE_BALL                                  | `shooterScore === gkScore`                         | VERIFIED | Line 71 exact match                             |
| gameHandlers.ts              | applyRoll                                                  | `applyRoll(room.gameState, d1, d2, d3)`            | VERIFIED | Line 291 in handler                             |
| gameEngine.ts                | validateShotDuel / validatePassAccuracy / computeLooseBall | branch dispatch by state.phase                     | VERIFIED | Switch cases call all validators                |
| gameHandlers.ts              | broadcastState                                             | single broadcast after every resolution            | VERIFIED | Single broadcastState(io, room) in success path |
| gameHandlers.ts (GK restart) | applyGKRestart                                             | `applyGKRestart(room.gameState, choice, rollDice)` | VERIFIED | Line 339 in handler                             |
| gameHandlers.ts              | ball.carrierId GK piece via controlsGKTeam                 | `controlsGKTeam` helper                            | VERIFIED | 3 occurrences: definition + 1 guard use         |

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

| Behavior                                  | Command                                      | Result                                                                                          | Status |
| ----------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| shared test suite (130 tests)             | pnpm --filter @counter-attack/shared test    | 130 passed, 0 failed                                                                            | PASS   |
| server test suite (82 tests)              | pnpm --filter @counter-attack/server test    | 82 passed, 1 todo, 0 failed                                                                     | PASS   |
| Full repo build                           | pnpm -r build                                | All packages built successfully                                                                 | PASS   |
| stubDice absent from gameEngine.ts        | grep stubDice                                | 0 matches                                                                                       | PASS   |
| Math.random absent from server/src        | grep Math.random                             | 0 matches                                                                                       | PASS   |
| GAME_GK_RESTART in events.ts              | grep GAME_GK_RESTART events.ts               | 1 match in ClientEvents, 1 in ClientToServerEvents                                              | PASS   |
| applyGKRestart movementSlot after restart | code inspection + test review                | movementSlot not set; remains null from GK_RESTART; applyMove rejects all moves with WRONG_SLOT | FAIL   |
| SHOT tie phase transition                 | code inspection gameEngine.ts:527 + test:560 | phase set to 'MOVEMENT' not 'LOOSE_BALL'                                                        | FAIL   |

---

### Probe Execution

No probe scripts declared in plan. Step 7c: SKIPPED (no probe-\*.sh files for this phase).

---

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                         | Status    | Evidence                                                                                                                                                                                                         |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DICE-01     | 05-01, 05-02 | All dice rolls generated server-side using cryptographically random source                          | SATISFIED | diceUtils.ts uses crypto.randomInt; Math.random=0 in server/src; no dice generation in packages/client                                                                                                           |
| DICE-02     | 05-02        | Active player clicks "Roll" button to trigger roll; result broadcast to both clients simultaneously | SATISFIED | game:roll handler exists; broadcastState(io, room) broadcasts to all room members; integration test confirms both clients receive state                                                                          |
| SHOT-05     | 05-03        | After GK catches ball, they choose kick/throw/start Movement Phase                                  | PARTIAL   | GK_RESTART phase entered correctly; all three choices handled; but resulting MOVEMENT phase is non-functional (movementSlot:null) — the SHOT-05 "start a Movement Phase" option does not actually allow movement |

---

### Anti-Patterns Found

| File                              | Line    | Pattern                                                                        | Severity | Impact                                                                                                                                                               |
| --------------------------------- | ------- | ------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| packages/server/src/gameEngine.ts | 527     | phase:'MOVEMENT' after SHOT tie instead of 'LOOSE_BALL'                        | Blocker  | SHOT tie skips LOOSE_BALL phase; d1/d2 reused as Loose Ball dice (biased direction)                                                                                  |
| packages/server/src/gameEngine.ts | 457-470 | computeLooseBall receives d1 (accuracy die) as direction die                   | Warning  | Loose Ball direction biased toward low values when pass is inaccurate                                                                                                |
| packages/server/src/gameEngine.ts | 730-744 | computeLooseBall receives d1/d2 (attacker/defender dice) as direction/distance | Warning  | Loose Ball direction/distance biased by heading duel dice that produced the tie                                                                                      |
| packages/server/src/gameEngine.ts | 841-912 | All three applyGKRestart branches missing movementSlot:'ATTACKER_4'            | Blocker  | Any MOVEMENT phase entered via GK restart immediately rejects all game:move with WRONG_SLOT                                                                          |
| packages/server/src/gameEngine.ts | 391-400 | applyUndo missing movedPieceIds update (CR-03 from REVIEW)                     | Warning  | After undo, piece remains in movedPieceIds; re-moving the piece is rejected ALREADY_MOVED — but this is a Phase 4 bug surfaced by Phase 5 review, not a Phase 5 goal |

No TBD/FIXME/XXX debt markers found in modified files (confirmed by inspection; no blocked debt gate).

---

### Human Verification Required

No human verification items — the failures are observable in code.

---

## Gaps Summary

Three gaps block full goal achievement:

**Gap 1 — GK restart produces non-functional MOVEMENT phase (BLOCKER)**

After any of the three GK restart choices (kick, throw, movement), `applyGKRestart` spreads `...state` from GK_RESTART, inheriting `movementSlot: null`. The `applyMove` function guard `state.phase !== 'MOVEMENT' || state.movementSlot === null` immediately rejects every subsequent `game:move` with `WRONG_SLOT`. The game loop is stuck after GK restart. Fix: all three branches must set `movementSlot: 'ATTACKER_4'`, `movedPieceIds: []`, and `paceUsedByPieceId: {}`. This affects SHOT-05 requirement satisfaction.

**Gap 2 — SHOT tie transitions to MOVEMENT not LOOSE_BALL phase (BLOCKER)**

`validateShotDuel` correctly returns `outcome: 'LOOSE_BALL'` on tie. However, `applyRoll`'s SHOT branch immediately computes the landing via `computeLooseBall` and transitions to `phase: 'MOVEMENT'` (line 527), bypassing the `LOOSE_BALL` game phase. This means: (a) the LOOSE_BALL phase's own dice roll is never used for the shot tie scenario, and (b) the dice used for direction/distance are the same dice that produced the tie (shooter die d1, GK die d2), which are correlated and biased. The plan must-have explicitly says the tied shot duel should transition to LOOSE_BALL (not MOVEMENT), and the REVIEW CR-02 identifies this as a logic error.

**Gap 3 — Loose Ball direction/distance dice reuse in PASS and HEADER branches (WARNING)**

In the PASS inaccurate branch (lines 457-470) and HEADER tie branch (lines 730-744), `computeLooseBall` is called with d1 and d2, which were already used for the primary roll (accuracy die and header dice respectively). These dice are constrained by the outcome that triggered the Loose Ball: the accuracy die was low enough to fail, and the header dice produced a tie. The resulting Loose Ball direction distribution is biased rather than uniform 1-6. Fresh dice should be used (or the phase should transition to LOOSE_BALL for a separate roll).

---

### Note on Roadmap SC 2

Roadmap Success Criterion 2 says "dice result visible to both players **before any outcome is applied**." Implementation decision D-10 (locked in 05-CONTEXT.md) explicitly chose a single-broadcast model where dice AND outcome are in one `game:state` emit. The code follows D-10 faithfully. `lastDiceRoll` is embedded in state so players see what was rolled, but the phase has already advanced. This is an intentional design deviation from SC-2's literal wording, documented in CONTEXT.md. Flagged as design-level uncertainty but not counted as a code gap since D-10 was a deliberate, documented decision.

### Note on applyUndo movedPieceIds (CR-03)

REVIEW finding CR-03 identifies that `applyUndo` does not restore `movedPieceIds`. This prevents re-moving a piece after an undo in ATTACKER_2. This bug was introduced in Phase 4 (`applyUndo` in 04-02-PLAN.md) and surfaced during Phase 5 review. It is not a Phase 5 deliverable — the undo functionality is Phase 7 scope (UNDO-01..04). Noted as a carry-forward bug, not counted against Phase 5 gaps.

---

_Verified: 2026-05-30T12:50:00Z_
_Verifier: Claude (gsd-verifier)_
