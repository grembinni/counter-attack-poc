---
plan: 05-02
phase: 05-dice-resolver-all-resolution-branches
status: complete
started: 2026-05-30
completed: 2026-05-30
commits:
  - 7eae41a
  - 86eda07
  - 4959997
key-files:
  created:
    - packages/server/src/diceUtils.ts
    - packages/server/src/__tests__/diceUtils.test.ts
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.test.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/game.integration.test.ts
key-decisions:
  - 'rollDice() is the sole dice source for all server-side randomness; no Math.random permitted'
  - 'applyRoll is pure (does not call rollDice); handler pre-generates up to 3 dice and passes them in (Pitfall 4)'
  - 'PASS accuracy uses HIGH type by default in applyRoll (both High Pass and Long Pass route through this branch in Phase 5)'
  - 'HEADER with defender > 2 hexes treated as uncontested (HEAD-02 auto-win → GK aerial challenge)'
  - 'Loose Ball in SAVE SPILL uses shooterDice as direction, gkDice as distance (reuses pre-generated dice)'
tags: [dice, game-engine, server, websocket, tdd]
---

## Summary

Replaced the deterministic dice stub with cryptographic dice (rollDice via crypto.randomInt), added applyRoll dispatcher covering PASS/SHOT/HEADER/LOOSE_BALL with all resolution branches, and wired the game:roll Socket.io handler with isProcessing mutex + guard + single-broadcast pattern.

## What Was Built

**Task 1 — diceUtils.rollDice() and stubDice() removal:**

- Created `packages/server/src/diceUtils.ts`: named export `rollDice()` wrapping `randomInt(1, 7)` from Node's crypto module (D-08, DICE-01). JSDoc documents the d6 range and exclusivity constraint.
- Created `packages/server/src/__tests__/diceUtils.test.ts`: two tests — range (100 calls all in [1,6]) and distribution (20 calls produce >= 3 distinct values, statistical non-flaky).
- Removed `stubDice()` function from `gameEngine.ts`.
- Replaced the STEAL_ATTEMPT path `stubDice()` call with `rollDice()` + `computeCombinedScore(defender.tackling, dice, []) >= 10` (MOVE-04 threshold).
- Added `computeCombinedScore` import to `gameEngine.ts` (previously missing for the steal calculation).

**Task 2 — applyRoll dispatcher:**

- Exported `ApplyRollResult` discriminated union: `{ ok: false; reason: 'WRONG_PHASE' | 'WRONG_TEAM' } | { ok: true; state: GameState }`.
- Exported `applyRoll(state: GameState, ...dice: number[]): ApplyRollResult` — pure function, dispatches by `state.phase`:
  - **PASS**: `validatePassAccuracy(carrier, 'HIGH', d1, [])` — accurate → phase 'SHOT'; inaccurate → `computeLooseBall`, phase 'LOOSE_BALL'.
  - **SHOT**: `validateGKDive` for penalty; `validateShotDuel` → GOAL/AUTO_MISS/LOOSE_BALL(tie)/SAVE; on SAVE: `validateHandlingCheck` → CAUGHT→GK_RESTART or SPILL→MOVEMENT.
  - **HEADER**: nearest defender found by `hexDistance`; uncontested (> 2 hexes) → GK aerial challenge with `aerialAbility`; contested → `validateHeading` penaltyModifier + `computeCombinedScore` comparison → attacker win+GK challenge / defender win / tie.
  - **LOOSE_BALL**: `computeLooseBall(position, d1, d2)` → phase 'MOVEMENT'.
  - **default**: `{ ok: false, reason: 'WRONG_PHASE' }` (Pitfall 8 exhaustive guard).
- Every `ok: true` return embeds `lastDiceRoll: { rolls: [...], context: '...' }` (D-10, D-11).
- applyRoll does NOT call rollDice (pure engine, deterministic for tests).
- Added `highPass` to existing test fixtures in `gameEngine.test.ts` (required by updated `PlayerPiece` type from Plan 01).
- 11 new applyRoll tests covering all four dice phases + WRONG_PHASE rejection.

**Task 3 — game:roll handler:**

- Added `DICE_PHASES = new Set(['PASS','SHOT','HEADER','LOOSE_BALL'])` to `gameHandlers.ts` (GK_RESTART handled by Plan 03 game:gk-restart handler per D-12/D-22).
- Registered `socket.on(ClientEvents.GAME_ROLL, () => { ... })` inside `registerGameHandlers`:
  - `if (!room || room.isProcessing) return;` — SC-5 double-click drop.
  - `room.isProcessing = true` inside `try`; `finally { room.isProcessing = false }` — Pitfall 5.
  - Phase guard: `!DICE_PHASES.has(room.gameState.phase)` → `GAME_ERROR 'WRONG_PHASE'` + snap-back (T-05-04).
  - Team guard: `!isActivePlayer(socket, room)` → `GAME_ERROR 'WRONG_TEAM'` + snap-back (T-05-03).
  - Pre-generates `d1 = rollDice(), d2 = rollDice(), d3 = rollDice()` (Pitfall 4).
  - Calls `applyRoll(room.gameState, d1, d2, d3)` → on success: `broadcastState(io, room)` (ARCH-04).
- Added `game.integration.test.ts` scenarios:
  - Successful `game:roll` in PASS phase: both clients receive state with `lastDiceRoll` populated and phase advanced from PASS.
  - `game:roll` from non-active player → `WRONG_TEAM`.
  - `game:roll` in MOVEMENT phase → `WRONG_PHASE`.

## Deviations from Plan

**[Rule 1 - Bug] Stale @counter-attack/shared dist triggered during Task 2**

- **Found during:** Task 2 TypeScript check
- **Issue:** The shared package `dist/` folder was not rebuilt after Plan 01 changes (missing `highPass` and `lastDiceRoll` in compiled `.d.ts` files). TypeScript resolved `@counter-attack/shared` via the dist symlink, not source.
- **Fix:** Ran `npx tsc` in `packages/shared` to rebuild dist before proceeding.
- **Files modified:** `packages/shared/dist/` (regenerated, not committed — build output)

**[Rule 2 - Missing field] highPass missing from existing test fixtures**

- **Found during:** Task 2 TypeScript check (after rebuilding shared dist)
- **Issue:** `homePiece` and `awayPiece` in `gameEngine.test.ts` were missing `highPass: number` which became required in Plan 01.
- **Fix:** Added `highPass: 5` (FWD value) and corrected `aerialAbility: 0` per D-05 for both FWD fixtures.
- **Files modified:** `packages/server/src/__tests__/gameEngine.test.ts`

**[Rule 3 - Blocked] Integration test needed ball carrier for PASS phase test**

- **Found during:** Task 3 integration test execution
- **Issue:** `applyRoll` in PASS phase requires `ball.carrierId` to be set (to find the passer's attributes). The initial game state has `carrierId: null` and no FSM transition automatically assigns a carrier.
- **Fix:** Import `getRoom` in the integration test file and directly set `room.gameState.ball.carrierId` to the attacking team's first outfielder (`${attackingTeam}-1`) before emitting `game:roll`. This is valid in a server-side test that has access to the room store.
- **Files modified:** `packages/server/src/__tests__/game.integration.test.ts`

## Known Stubs

None — all resolution branches are fully wired. No placeholder values or TODO comments remain in any file created or modified in this plan.

## Threat Surface Scan

The `game:roll` handler adds a new network event (`game:roll`) on the client→server boundary. This was already planned in the threat model and mitigated:

| Flag                         | File            | Description                                                                     |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------- |
| threat_flag: spoofing        | gameHandlers.ts | game:roll in wrong phase → WRONG_PHASE + snap-back (T-05-04, mitigated)         |
| threat_flag: tampering       | gameHandlers.ts | game:roll from wrong team → WRONG_TEAM + snap-back (T-05-03, mitigated)         |
| threat_flag: DoS             | gameHandlers.ts | double-click → isProcessing mutex drop (T-05-05, mitigated)                     |
| threat_flag: info-disclosure | diceUtils.ts    | crypto.randomInt only; Math.random: 0 occurrences verified (T-05-06, mitigated) |

All flags were in the plan's threat register and are mitigated.

## Self-Check: PASSED

- `packages/server/src/diceUtils.ts` exists: FOUND
- `packages/server/src/__tests__/diceUtils.test.ts` exists: FOUND
- `grep -q "applyRoll" packages/server/src/gameEngine.ts`: FOUND
- `grep -q "GAME_ROLL" packages/server/src/gameHandlers.ts`: FOUND
- `grep -c "stubDice" packages/server/src/gameEngine.ts` → 0: VERIFIED
- `grep -rn "Math.random" packages/server/src` → none: VERIFIED
- Commits 7eae41a, 86eda07, 4959997 in git log: VERIFIED
- `npx vitest run` in packages/server → 73 passed, 1 todo, 0 failed: VERIFIED
