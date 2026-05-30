# Phase 5: Dice Resolver + All Resolution Branches — Research

**Researched:** 2026-05-30
**Domain:** Server-side game FSM — crypto dice, pass accuracy, shot/save duels, heading duels, Loose Ball, GK restart
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Hybrid rules — boxed rulebook (2019) is ground truth; v1.4.1 additions retained where they add strategic depth.
- **D-02:** Retained from v1.4.1: long ball accuracy check (9+/10+ by third), GK restart three-option choice, GK kick accuracy check (High Pass rules), `handling` attribute for post-save catch/spill.
- **D-03:** Applied from boxed rulebook: `highPass` is a named player attribute; duel ties → Loose Ball; inaccurate High Pass → Loose Ball (existing behaviour correct).
- **D-04:** Add `highPass: number` to `PlayerPiece` in `packages/shared/src/types.ts`. Used for High Pass accuracy; outfielders have meaningful values; GKs have `highPass: 0`.
- **D-05:** `aerialAbility` stays GK-only in practice (outfielders `aerialAbility: 0`). Used for GK competing in heading duels.
- **D-06:** `handling` stays on `PlayerPiece` (v1.4.1 retention). Used in `validateHandlingCheck`. GKs have meaningful value; outfielders `handling: 0`.
- **D-07:** Update `packages/shared/src/teams.ts` to add realistic `highPass` values to all outfielders; set `highPass: 0` on GKs.
- **D-08:** All dice exclusively from `crypto.randomInt(1, 7)` on the server. Zero RNG in client or shared. DICE-01.
- **D-09:** `rollDice()` helper added to `packages/server/src/diceUtils.ts`. Pure wrapper around `crypto.randomInt`. Injected into validator calls — validators never roll their own dice.
- **D-10:** Single-broadcast model: `game:roll` triggers roll → apply outcome → broadcast one `game:state` with `lastDiceRoll` embedded. No intermediate "dice pending" state.
- **D-11:** Add `lastDiceRoll?: { rolls: number[]; context: string }` to `GameState` in `types.ts`.
- **D-12:** `game:roll` valid only when `GameState.phase` is a dice-requiring phase; rejected with `game:error` otherwise.
- **D-13:** Shot and heading duel ties → Loose Ball. Update `validateShotDuel` to return `{ outcome: 'LOOSE_BALL' }` on tie.
- **D-14:** Fix `validatePassAccuracy`: change `piece.aerialAbility` → `piece.highPass` for the HIGH case.
- **D-15:** Inaccurate High Pass → Loose Ball (existing `triggerLooseBall: true` is correct).
- **D-16:** `AccuracyResult` does not need a new branch — both High and Long inaccuracy produce `{ accurate: false; triggerLooseBall: true }`.
- **D-17:** Update `validateShotDuel` return type: add `{ outcome: 'LOOSE_BALL' }` for ties. Signature unchanged.
- **D-18:** SHOT-03 and SHOT-04 are advanced rules but already implemented and tested — retain them.
- **D-19:** Loose Ball uses two dice: direction (1–6) and distance (1–6). Both rolled server-side. DICE-03, DICE-04, DICE-05.
- **D-20:** `resolveLoseBall(incidentHex, directionRoll, distanceRoll)` pure function added (placement TBD by Claude).
- **D-21:** After Loose Ball: `ball.position` = landing hex, `ball.carrierId = null`, phase → MOVEMENT (attacker gets possession).
- **D-22:** GK restart uses single event `game:gk-restart` with payload `{ choice: 'kick' | 'throw' | 'movement' }`.
- **D-23:** GK restart valid only when `phase === 'GK_RESTART'` and emitting player is GK's team.
- **D-24:** GK kick = High Pass rules from GK's position: GK's `highPass` + dice ≥ 8. Inaccurate → Loose Ball from target hex. GK may not kick into opposite final third.
- **D-25:** GK quick throw = Standard Pass distance (max 11 hexes), uninterceptable, no accuracy check.
- **D-26:** GK movement = team starts Movement Phase immediately; `phase → MOVEMENT`, `attackingTeam = GK's team`.
- **D-27:** Heading duel: both challengers roll + heading; higher wins (ties → Loose Ball). Attacker's heading score locked; GK then rolls once + saving vs locked score.
- **D-28:** GK competing for high cross uses `aerialAbility`. GK wins → GK catches (→ GK_RESTART). Attacker wins → goal.

### Claude's Discretion

- Direction mapping for Loose Ball direction rolls 1–6: Claude picks deterministic axial mapping and documents as constant.
- `lastDiceRoll` field shape in `GameState`: Claude defines exact structure.
- `resolveLoseBall` placement (shared vs server): Claude decides based on whether it needs `GameState.pieces` for boundary clamping.

### Deferred Ideas (OUT OF SCOPE)

- Client rendering of dice rolls and resolution animations (Phase 6–7).
- Match lifecycle: action counter, added time, half transitions (Phase 8).
- Fouls, bookings, injuries, set pieces (out of scope for v1).
- Corner kicks, throw-ins, free kicks (out of scope for v1).
- MOVE-07 snapshot during movement (Phase 5 resolves it when triggered during movement — actually deferred to Phase 5 per CONTEXT.md but not fully scoped here).
- Advanced rules: tackles from behind, extra yard injury, difficult-angle shooting penalties.
- GK kick range restriction enforcement (deferred in CONTEXT.md).
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                   | Research Support                                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DICE-01 | All dice rolls generated server-side using a cryptographically random source                                                                                  | `crypto.randomInt(1, 7)` is Node.js built-in, no external package. Wrap in `diceUtils.ts`. Replaces `stubDice()` in `gameEngine.ts`.                                                                        |
| DICE-02 | Active player clicks "Roll" button to trigger roll; result broadcast to both clients simultaneously                                                           | `game:roll` event already defined in `ClientEvents`/`ClientToServerEvents` (events.ts). Handler goes in `gameHandlers.ts` with isProcessing mutex. `broadcastState` is the single broadcast path (ARCH-04). |
| SHOT-05 | After GK catches the ball, they choose: kick (High Pass accuracy check, 8+), quick throw (Standard Pass distance, uninterceptable), or start a Movement Phase | New `game:gk-restart` event + handler. Three branches: kick (validatePassAccuracy with GK's highPass), throw (validate max 11 hexes), movement (phase → MOVEMENT).                                          |

</phase_requirements>

---

## Summary

Phase 5 replaces deterministic dice stubs with cryptographic randomness and wires every stochastic branch of the game FSM end-to-end. The work is almost entirely server-side (`packages/server` and `packages/shared`) with no client changes required — the client already receives `GameState` via `game:state` broadcasts and will display dice results via the new `lastDiceRoll` field added to `GameState`.

The key engineering challenge is not the dice themselves (Node.js `crypto.randomInt` is trivial) but the FSM branch routing: a single `game:roll` event must dispatch to the correct resolution logic based on `GameState.phase`, and each resolution path produces a different successor state (GOAL, SAVE → GK_RESTART, LOOSE_BALL, MOVEMENT). Each branch must be implemented as a pure `apply*` function in `gameEngine.ts`, following the discriminated union + immutable spread pattern already established in Phases 3 and 4.

The codebase is in excellent shape for this phase. `computeCombinedScore` and `computeLooseBall` already exist in `scoreUtils.ts`, all validator functions (`validateShotDuel`, `validatePassAccuracy`, `validateHandlingCheck`, `validateGKDive`, `validateHeading`) already exist in `shared/src`, and `broadcastState` is wired. The changes are surgical: one type field addition, two attribute fixes, two discriminated union expansions, one new `diceUtils.ts` file, two new event handlers, and `apply*` functions connecting them to the FSM.

**Primary recommendation:** Organise work as three waves — (1) shared type/validator fixes, (2) server dice infrastructure + `game:roll` handler with shot/pass/heading branches, (3) GK restart handler. Test each wave with unit tests before advancing.

---

## Architectural Responsibility Map

| Capability                                 | Primary Tier                               | Secondary Tier | Rationale                                                                    |
| ------------------------------------------ | ------------------------------------------ | -------------- | ---------------------------------------------------------------------------- |
| Dice generation                            | Server (`packages/server`)                 | —              | D-08 decision; crypto source not available client-side in a trustable way    |
| Pass accuracy validation                   | Shared (`packages/shared`)                 | —              | Pure function, already exists; server calls it with injected dice            |
| Shot duel resolution                       | Shared (`packages/shared`)                 | —              | Pure function, already exists; server calls it with injected dice            |
| Heading duel resolution                    | Shared (`packages/shared`)                 | —              | Pure function, already exists; extension needed for GK aerial case           |
| Loose Ball destination                     | Shared (`packages/shared`)                 | —              | `computeLooseBall` already exists in `scoreUtils.ts`; no state access needed |
| FSM state transitions                      | Server (`packages/server/gameEngine.ts`)   | —              | All apply\* functions live here; follows established pattern                 |
| Event routing (game:roll, game:gk-restart) | Server (`packages/server/gameHandlers.ts`) | —              | Follows existing game:move / game:end-turn handler pattern                   |
| State broadcast                            | Server (`packages/server/roomStore.ts`)    | —              | `broadcastState()` is the single ARCH-04 entry point                         |
| Type contracts                             | Shared (`packages/shared/types.ts`)        | —              | `PlayerPiece` needs `highPass`; `GameState` needs `lastDiceRoll`             |
| Team attribute data                        | Shared (`packages/shared/teams.ts`)        | —              | `highPass` values must be added to all 22 players                            |

---

## Standard Stack

### Core (no new packages needed)

Phase 5 requires zero new npm packages. All required functionality already exists in the project or in Node.js built-ins.

[VERIFIED: Node.js docs] `crypto.randomInt(min, max)` — built-in Node.js 22 LTS. Returns a cryptographically secure random integer where `min <= result < max`. For a d6: `crypto.randomInt(1, 7)` returns 1–6 inclusive.

| Library                  | Version     | Purpose                                        | Status                                                         |
| ------------------------ | ----------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `crypto` (built-in)      | Node 22 LTS | `crypto.randomInt(1, 7)` for d6 dice           | Already used in `gameEngine.ts` for coin flip and referee card |
| `socket.io`              | 4.8.3       | Event routing (`game:roll`, `game:gk-restart`) | Already installed                                              |
| `vitest`                 | 2.1.9       | Unit and integration tests                     | Already installed in both packages                             |
| `@counter-attack/shared` | workspace   | Shared validators, types, events               | Already wired                                                  |

### No New Packages

The package legitimacy audit is not required for this phase — no external packages are installed.

---

## Package Legitimacy Audit

**No new packages installed in this phase.** All required functionality is in existing dependencies or Node.js built-ins.

---

## Architecture Patterns

### System Architecture Diagram

```
Client (either player)
    |
    | game:roll  (no payload)
    v
gameHandlers.ts — registerGameHandlers()
    |
    | 1. isProcessing mutex
    | 2. phase guard (reject WRONG_PHASE)
    | 3. activeTeam guard (reject WRONG_TEAM)
    v
gameEngine.ts — applyRoll(state, dice)
    |
    | dispatch by state.phase:
    |
    +-- phase=PASS ---------> applyPassResolution(state, dice)
    |                              |
    |                              +-- validatePassAccuracy(piece, passType, dice, penalties)
    |                              |     accurate? → phase=SHOT (or HEADER for High Pass)
    |                              |     inaccurate? → computeLooseBall() → phase=LOOSE_BALL
    |                              +-- returns new GameState with lastDiceRoll
    |
    +-- phase=SHOT ---------> applyShot(state, shooterDice, gkDice)
    |                              |
    |                              +-- validateGKDive(gk, distance) → savingPenalty
    |                              +-- validateShotDuel(shooter, gk, d1, d2, penalties, gkPenalties)
    |                              |     GOAL → phase=KICK_OFF (score++)
    |                              |     LOOSE_BALL (tie) → computeLooseBall() → phase=MOVEMENT
    |                              |     SAVE → validateHandlingCheck(gk, handlingDice)
    |                              |               caught → phase=GK_RESTART
    |                              |               spill → computeLooseBall() → phase=MOVEMENT
    |                              +-- returns new GameState with lastDiceRoll
    |
    +-- phase=HEADER -------> applyHeadingResolution(state, attackerDice, defenderDice, gkDice?)
    |                              |
    |                              +-- validateHeading() for each contestant
    |                              +-- attacker wins outfield → lock attacker score
    |                              |   → GK rolls + aerialAbility vs locked score
    |                              |     GK wins → phase=GK_RESTART
    |                              |     Attacker wins → phase=GOAL
    |                              +-- tie → computeLooseBall() → phase=MOVEMENT
    |                              +-- returns new GameState with lastDiceRoll
    |
    +-- phase=LOOSE_BALL ---> applyLooseBall(state, directionDice, distanceDice)
    |                              |
    |                              +-- computeLooseBall(incidentHex, d1, d2)
    |                              +-- ball.position = landing hex, carrierId=null
    |                              +-- phase=MOVEMENT, attackingTeam=attacker
    |                              +-- returns new GameState with lastDiceRoll
    |
    v
broadcastState(io, room)   ← single call after every apply*, regardless of outcome
    |
    v
Both clients receive game:state with updated GameState (including lastDiceRoll)
```

GK restart is a separate flow triggered by `game:gk-restart`:

```
Client (GK's team)
    |
    | game:gk-restart { choice: 'kick' | 'throw' | 'movement' }
    v
gameHandlers.ts — registerGameHandlers() (new handler)
    |
    | 1. isProcessing mutex
    | 2. phase guard (must be GK_RESTART)
    | 3. team guard (must be GK's team)
    v
gameEngine.ts — applyGKRestart(state, choice)
    |
    +-- choice='kick'     → validatePassAccuracy(gk, 'HIGH', rollDice(), [])
    |                          accurate? → ball at target, phase=MOVEMENT
    |                          inaccurate? → computeLooseBall() → phase=MOVEMENT
    |                         (GK kick range restriction: reject if target in opposite final third)
    |
    +-- choice='throw'    → validate distance ≤ 11 hexes
    |                        → ball at target (uninterceptable), phase=MOVEMENT
    |
    +-- choice='movement' → phase=MOVEMENT, attackingTeam=GK's team
    |
    v
broadcastState(io, room)
```

### Recommended File Structure Changes

```
packages/shared/src/
├── types.ts              ← ADD: highPass to PlayerPiece, lastDiceRoll to GameState
├── teams.ts              ← ADD: highPass attribute to all 22 players
├── events.ts             ← ADD: GAME_GK_RESTART to ClientEvents + ClientToServerEvents
├── passValidator.ts      ← FIX: aerialAbility → highPass in validatePassAccuracy
├── shotValidator.ts      ← CHANGE: tie outcome SAVE → LOOSE_BALL in validateShotDuel
│                                    ADD: { outcome: 'LOOSE_BALL' } to ShotDuelResult union
└── headingValidator.ts   ← EXTEND: add GK aerial case (aerialAbility) to heading duel

packages/server/src/
├── diceUtils.ts          ← NEW: rollDice() pure wrapper around crypto.randomInt(1,7)
├── gameEngine.ts         ← ADD: applyRoll(), applyGKRestart()
│                                 REMOVE: stubDice() and its call sites
│                                 EXTEND: apply* functions for each resolution branch
└── gameHandlers.ts       ← ADD: game:roll handler, game:gk-restart handler
                                  (follow existing isProcessing mutex pattern)
```

### Pattern 1: `apply*` Engine Function

Every state transition is a pure function: `(state: GameState, ...args) => { ok: boolean; state?: GameState; reason?: string }`. No Socket.io imports. Validators are injected with dice values, never generating their own.

```typescript
// Source: established pattern in packages/server/src/gameEngine.ts
export type ApplyRollResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'WRONG_TEAM' }
  | { ok: true; state: GameState };

export function applyRoll(state: GameState, ...dice: number[]): ApplyRollResult {
  // dispatch by state.phase
  // call validator with injected dice
  // return immutable new state via spread
}
```

### Pattern 2: Handler Registration with isProcessing Mutex

Every handler in `registerGameHandlers` follows this exact structure. Phase 5 adds two new handlers using this pattern verbatim:

```typescript
// Source: packages/server/src/gameHandlers.ts (game:move handler)
socket.on(ClientEvents.GAME_ROLL, () => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5: drop duplicate

  room.isProcessing = true;
  try {
    // phase guard → emit GAME_ERROR + broadcastState (snap-back)
    // team guard  → emit GAME_ERROR + broadcastState
    // roll dice via rollDice()
    // apply result via applyRoll()
    // room.gameState = result.state
    broadcastState(io, room); // ARCH-04
  } finally {
    room.isProcessing = false; // MUST be in finally
  }
});
```

### Pattern 3: Discriminated Union Result Extension

When adding a new outcome to `ShotDuelResult`, follow the existing discriminated union pattern:

```typescript
// Source: packages/shared/src/shotValidator.ts
// Current:
export type ShotDuelResult =
  | { outcome: 'GOAL' }
  | { outcome: 'MISS'; reason: 'AUTO_MISS' }
  | { outcome: 'SAVE'; needsHandlingCheck: true };

// After D-13 change (add LOOSE_BALL, change tie behaviour):
export type ShotDuelResult =
  | { outcome: 'GOAL' }
  | { outcome: 'MISS'; reason: 'AUTO_MISS' }
  | { outcome: 'SAVE'; needsHandlingCheck: true }
  | { outcome: 'LOOSE_BALL' }; // tie result per D-13
```

### Pattern 4: Dice Injection into Validators

Dice are never generated inside validator functions. `diceUtils.ts` provides `rollDice()`, which is called in the handler or `apply*` function and passed as an argument:

```typescript
// packages/server/src/diceUtils.ts
import { randomInt } from 'crypto';
export function rollDice(): number {
  return randomInt(1, 7); // returns 1, 2, 3, 4, 5, or 6
}

// In applyShot() — handler side:
const shooterDice = rollDice();
const gkDice = rollDice();
const handlingDice = rollDice();
const result = validateShotDuel(shooter, gk, shooterDice, gkDice, shooterPenalties, gkPenalties);
```

### Pattern 5: `lastDiceRoll` Shape in GameState

`lastDiceRoll` is overwritten on every dice action. Client uses it to render the dice roll result before the board state updates. Context string identifies which resolution branch produced the rolls.

```typescript
// In packages/shared/src/types.ts
export type GameState = {
  // ... existing fields ...
  lastDiceRoll?: {
    rolls: number[]; // ordered array of dice values
    context: string; // e.g. 'PASS_ACCURACY', 'SHOT_DUEL', 'LOOSE_BALL', 'GK_KICK'
  } | null;
};
```

Recommended context string values (Claude's discretion per CONTEXT.md):

- `'PASS_ACCURACY'` — High Pass or Long Pass accuracy check
- `'SHOT_DUEL'` — shot + save + handling check (all in one)
- `'HEADING_DUEL'` — heading duel rolls
- `'LOOSE_BALL'` — direction + distance rolls
- `'GK_KICK'` — GK kick accuracy check

### Pattern 6: `resolveLoseBall` Placement Decision

The CONTEXT.md grants Claude discretion on `resolveLoseBall` placement. The analysis:

- `computeLooseBall(from, direction, distance)` **already exists** in `scoreUtils.ts` and returns the raw destination `HexCoord`.
- It does NOT need `GameState.pieces` — boundary clamping is deferred (Phase 4 note: "Boundary validation deferred to Phase 4 when PITCH_HEXES contains real coordinates").
- Therefore: **`resolveLoseBall` is not a new function.** Phase 5 calls `computeLooseBall` directly from `applyRoll` / `applyShot` and uses the result to update `GameState.ball.position`. No wrapper needed.

### Anti-Patterns to Avoid

- **Calling `rollDice()` inside validator functions.** Validators receive dice as arguments. All dice generated in `apply*` or handler scope.
- **Using `socket.rooms` to identify the player's team.** Read `socket.data.playerSlot` exclusively (existing Pitfall 2 in STATE.md).
- **Placing `room.isProcessing = false` in a `catch` block or conditional.** Must be in `finally` always (existing Pitfall 5 in STATE.md).
- **Mutating `state.pieces` or `state.eventLog` in place.** All state transitions use spread + `[...array]` (immutable pattern from Phase 4).
- **Emitting events via `io.to(room.roomCode).emit()` directly.** Always use `broadcastState(io, room)` (ARCH-04).
- **Generating dice on the client.** Zero RNG in `packages/client` or `packages/shared`. D-08.
- **Adding imports from `socket.io` in `gameEngine.ts`.** Engine functions are pure — no Socket.io imports (established pattern).
- **Setting `highPass: 0` on outfielders without also handling the `aerialAbility: 0` convention.** Both attributes have the same role-based zero-value convention — be consistent across the squad update.

---

## Don't Hand-Roll

| Problem              | Don't Build                      | Use Instead                                 | Why                                                                                                       |
| -------------------- | -------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Cryptographic dice   | Manual `Math.random()` scaling   | `crypto.randomInt(1, 7)`                    | `Math.random()` is not cryptographically random; `crypto.randomInt` already used in project for coin flip |
| Loose Ball position  | Custom direction/distance math   | `computeLooseBall()` in `scoreUtils.ts`     | Already implemented, tested (8 tests in `scoreUtils.test.ts`), direction map already defined              |
| -2 penalty cap       | Inline `Math.max`                | `computeCombinedScore()` in `scoreUtils.ts` | Already implemented, DICE-04 compliant; all existing validators use it                                    |
| Combined score calc  | Inline attribute + dice math     | `computeCombinedScore()`                    | Same as above                                                                                             |
| State broadcast      | `io.to(roomCode).emit()` inline  | `broadcastState(io, room)`                  | ARCH-04; single entry point already established                                                           |
| Validator dice logic | Dice generation inside validator | Inject via `rollDice()` from handler        | Established pattern; validators are pure functions                                                        |

**Key insight:** The shared package already contains all the math needed for Phase 5. The work is wiring the existing pure functions to the server FSM with live dice rather than building new math.

---

## Common Pitfalls

### Pitfall 1: `stubDice()` Call Sites Left Alive

**What goes wrong:** `gameEngine.ts` contains `stubDice()` with a `// TODO Phase 5: replace` comment. It is called in the `applyMove` handler for STEAL_ATTEMPT effects. If Phase 5 only adds new `game:roll` logic without removing the stub, the codebase will have two dice sources.

**Why it happens:** The TODO comment is in the movement handler, which is a different code path from the new dice resolution. Easy to miss.

**How to avoid:** Search for `stubDice` in the codebase at the start of Phase 5. There is exactly one call site in `applyMove`'s steal resolution. Replace it and delete the function.

**Warning signs:** TypeScript will not catch this — `stubDice()` is valid code. Run a grep for `stubDice` as a verification step.

### Pitfall 2: `highPass` Added to `PlayerPiece` Type But Not to All Fixtures

**What goes wrong:** `teams.test.ts` already tests that every player has all 9 attributes as integers in 1–10. When `highPass` is added to `PlayerPiece`, all test fixtures in `gameEngine.test.ts`, `game.integration.test.ts`, and `shotValidator.test.ts` that construct `PlayerPiece` objects inline will fail TypeScript compilation.

**Why it happens:** Test fixtures are inline objects with spread patterns; adding a required field to the type breaks them all.

**How to avoid:** After adding `highPass` to `PlayerPiece`, use TypeScript compilation errors as the comprehensive list of fixtures to update. Also update `teams.test.ts`'s ATTRIBUTES array to include `'highPass'`.

**Warning signs:** `pnpm typecheck` fails with 10–20 errors on test fixture objects. Expected — not a real problem, just fix each one.

### Pitfall 3: Tie Handling Test Expecting Old SAVE Behaviour

**What goes wrong:** `shotValidator.test.ts` line 62 has `it('ties go to the GK (SAVE) — equal scores → SAVE not GOAL')`. This test verifies current behaviour. D-13 changes tie outcome to LOOSE_BALL. The test must be updated to expect `LOOSE_BALL`.

**Why it happens:** The test was written before the hybrid rules decision in the discussion phase.

**How to avoid:** When modifying `validateShotDuel`, update the test in the same commit. The test description will also need rewording to document the new behaviour.

**Warning signs:** Test suite passes on the old test but fails integration — tied duels produce SAVE state instead of triggering LOOSE_BALL.

### Pitfall 4: Handling Check Dice Rolled at Wrong Time

**What goes wrong:** Per D-10 (CONTEXT.md), shot duel + handling check are "all-in-one" — all dice rolled in a single `game:roll` event. If the handling check dice is rolled after the shot duel result is known, the server generates dice in response to a result rather than atomically, which is structurally wrong and makes state replay impossible.

**Why it happens:** The naive implementation generates shooterDice, gkDice, evaluates the shot, then conditionally generates handlingDice. This is actually correct implementation, but the rolls must all be pre-generated and embedded in `lastDiceRoll` before any state transition.

**How to avoid:** Generate ALL dice upfront in `applyShot`: `shooterDice`, `gkDice`, `handlingDice`. Pass all to the validators. Embed all in `lastDiceRoll.rolls` regardless of whether the handling check path is reached. The client sees every dice value that was pre-rolled.

**Warning signs:** `lastDiceRoll.rolls` sometimes has 2 elements (when shot misses) and sometimes 3 (when save reached). Client rendering must handle variable-length arrays; document the expected lengths per context string.

### Pitfall 5: GK Team Guard for `game:gk-restart`

**What goes wrong:** The `game:gk-restart` handler must validate that the emitting socket controls the GK's team, not just any team. The "active team" concept from movement phase doesn't directly apply here — the GK's team is the team that conceded the shot, which may not be `state.attackingTeam`.

**Why it happens:** The existing `isActivePlayer()` and `controlsAttackingTeam()` helpers in `gameHandlers.ts` check `attackingTeam`, which is the team that played the most recent movement phase. After a goal kick scenario, the GK team may be the defending team.

**How to avoid:** Add a `controlsGKTeam(socket, room)` helper that identifies which team's GK has the ball (via `ball.carrierId` or a `gkTeam` field that Phase 5 should set on GK_RESTART transition). The simplest approach: when transitioning to `GK_RESTART`, store `gkTeam: 'home' | 'away'` in `GameState` or derive it from `ball.carrierId`.

**Warning signs:** The wrong team can trigger GK restart, or the correct team gets WRONG_TEAM rejection.

### Pitfall 6: `aerialAbility: 0` on Outfielders Breaks Existing Tests

**What goes wrong:** Per D-05, outfielders should have `aerialAbility: 0` going forward. The existing `teams.test.ts` asserts `attribute >= 1` for all 9 attributes (including `aerialAbility`). If outfielders are set to `aerialAbility: 0`, the existing test fails.

**Why it happens:** The test was written before the decision to make `aerialAbility` GK-only with outfielders at 0.

**How to avoid:** Check whether D-05 actually requires setting `aerialAbility: 0` on outfielders NOW, or whether existing outfielder values (which range 4–7) are acceptable as placeholder values. The CONTEXT.md says "outfielders have `aerialAbility: 0`" — this conflicts with existing `teams.ts` data and the test. Resolution: update `teams.test.ts` to allow `aerialAbility` to be 0 for outfielders (add role-specific attribute range checking). Alternatively, only enforce `aerialAbility: 0` via convention, not via validator change. Document this tradeoff clearly in the plan.

**Warning signs:** `pnpm test` fails `teams.test.ts` immediately after setting outfielder `aerialAbility` values to 0.

### Pitfall 7: `handling: 0` on Outfielders Breaks Existing Tests

**What goes wrong:** Same as Pitfall 6, but for `handling`. D-06 says outfielders have `handling: 0`. Existing outfielder data in `teams.ts` has `handling: 1` for all non-GK players. The `teams.test.ts` `attribute >= 1` assertion will fail.

**How to avoid:** Update `teams.test.ts` to use role-aware attribute range checking, or accept that the convention is "documented but not strictly enforced in test data". The safest approach: set `handling: 0` in `teams.ts` data and update the test to allow 0 for `handling` on non-GK roles.

**Warning signs:** Same as Pitfall 6 — test failure immediately after updating `teams.ts`.

### Pitfall 8: `game:roll` Handler Routing by Phase — Missing Phases

**What goes wrong:** The `game:roll` handler dispatches to different resolution branches based on `state.phase`. If a phase is not covered (e.g., a future `SNAPSHOT` phase), the handler must emit `WRONG_PHASE` rather than silently doing nothing. An exhaustive switch/if-else with an explicit `default` case that emits `WRONG_PHASE` prevents silent no-ops.

**How to avoid:** Use a switch statement with an explicit `default: socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE')` branch. TypeScript's exhaustive union checking does not help here because `GamePhase` includes phases that Phase 5 doesn't handle yet.

---

## Code Examples

### crypto.randomInt for d6

```typescript
// Source: [VERIFIED: Node.js docs] nodejs.org/api/crypto.html#cryptorandomintmin-max-callback
// packages/server/src/diceUtils.ts
import { randomInt } from 'crypto';

/**
 * Rolls a single d6. Returns 1–6 inclusive.
 * All dice in the game use this function — no other RNG source permitted (D-08, DICE-01).
 */
export function rollDice(): number {
  return randomInt(1, 7); // min inclusive, max exclusive → 1..6
}
```

### Updated ShotDuelResult (D-13 + D-17)

```typescript
// packages/shared/src/shotValidator.ts — updated union
export type ShotDuelResult =
  | { outcome: 'GOAL' }
  | { outcome: 'MISS'; reason: 'AUTO_MISS' }
  | { outcome: 'SAVE'; needsHandlingCheck: true }
  | { outcome: 'LOOSE_BALL' }; // ties → Loose Ball per D-13

// Updated comparison in validateShotDuel:
// Before: if (shooterScore > gkScore) return { outcome: 'GOAL' };
//         return { outcome: 'SAVE', needsHandlingCheck: true };
// After:
if (shooterScore > gkScore) return { outcome: 'GOAL' };
if (shooterScore === gkScore) return { outcome: 'LOOSE_BALL' }; // D-13: tie → Loose Ball
return { outcome: 'SAVE', needsHandlingCheck: true };
```

### validatePassAccuracy Fix (D-14)

```typescript
// packages/shared/src/passValidator.ts
// Line 144 — change aerialAbility → highPass for HIGH case
// Before:
const attribute = passType === 'HIGH' ? piece.aerialAbility : piece.dribbling;
// After:
const attribute = passType === 'HIGH' ? piece.highPass : piece.dribbling;
```

### lastDiceRoll in GameState (D-11)

```typescript
// packages/shared/src/types.ts — added field
export type GameState = {
  // ... all existing fields unchanged ...
  /**
   * D-11 / Phase 5: Dice rolls from the most recent dice action.
   * Embedded in GameState so both clients see the rolls before rendering the outcome.
   * null when no dice have been rolled yet (KICK_OFF, LOBBY phases).
   */
  lastDiceRoll?: {
    rolls: number[]; // ordered dice values; length varies by context (1-3)
    context: string; // 'PASS_ACCURACY' | 'SHOT_DUEL' | 'HEADING_DUEL' | 'LOOSE_BALL' | 'GK_KICK'
  } | null;
};
```

### GK Restart Event (D-22)

```typescript
// packages/shared/src/events.ts additions
export const ClientEvents = {
  // ... existing ...
  GAME_GK_RESTART: 'game:gk-restart',
} as const;

export interface ClientToServerEvents {
  // ... existing ...
  [ClientEvents.GAME_GK_RESTART]: (choice: 'kick' | 'throw' | 'movement') => void;
}
```

### highPass Attribute Addition (D-04, D-07)

```typescript
// packages/shared/src/types.ts — PlayerPiece addition
export type PlayerPiece = {
  // ... existing attributes ...
  aerialAbility: number;
  /**
   * D-04 (Phase 5): High Pass accuracy attribute.
   * Outfielders: meaningful value (suggest 3–8 by position).
   * GKs: 0 (per D-04 — GKs use High Pass rules for kicks but have low accuracy by design).
   */
  highPass: number;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
};
```

Recommended `highPass` values for teams.ts (Claude's discretion on exact values):

- GK: `highPass: 0` (cannot pass accurately — use GK kick accuracy rule)
- DEF: `highPass: 3–5` (can play long balls but not reliably)
- MID: `highPass: 5–7` (playmakers can hit high balls)
- FWD: `highPass: 4–6` (decent aerial passing ability)

---

## State of the Art

| Old Approach                            | Current Approach               | When Changed   | Impact                                                                  |
| --------------------------------------- | ------------------------------ | -------------- | ----------------------------------------------------------------------- |
| `Math.random()` for game dice           | `crypto.randomInt()`           | Phase 5        | Cryptographically secure; consistent with coin flip already in codebase |
| `stubDice() → 3` in gameEngine          | `rollDice()` from diceUtils.ts | Phase 5        | Live random resolution; stubs removed                                   |
| Tie on shot duel → SAVE                 | Tie → LOOSE_BALL               | Phase 5 (D-13) | Ties are meaningful outcomes; removes GK advantage on equal scores      |
| High Pass accuracy uses `aerialAbility` | Uses `highPass` attribute      | Phase 5 (D-14) | Correct rulebook attribute mapping                                      |

**Deprecated/outdated:**

- `stubDice()` in `gameEngine.ts`: replaced by `rollDice()` from `diceUtils.ts`. Remove entirely.
- `piece.aerialAbility` in `validatePassAccuracy` HIGH branch: replace with `piece.highPass`.
- Comment `// Ties go to the GK` in `validateShotDuel`: remove entirely.

---

## Runtime State Inventory

This is a code/validator phase with no rename or migration. No runtime state inventory required.

---

## Environment Availability

| Dependency                | Required By                 | Available | Version                       | Fallback |
| ------------------------- | --------------------------- | --------- | ----------------------------- | -------- |
| Node.js `crypto` built-in | `crypto.randomInt` for dice | Yes       | Node 24.15.0 (>= 22 required) | —        |
| `vitest`                  | Test runner                 | Yes       | 2.1.9 (shared + server)       | —        |
| `pnpm`                    | Workspace test runner       | Yes       | 9.x                           | —        |
| `socket.io` 4.x           | Event handlers              | Yes       | 4.8.3                         | —        |

No missing dependencies. All required tooling is present.

---

## Validation Architecture

### Test Framework

| Property                | Value                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| Framework               | Vitest 2.1.9                                                         |
| Config file             | Per-package (no root vitest.config.ts; `vitest run` in each package) |
| Quick run — shared only | `pnpm --filter @counter-attack/shared test`                          |
| Quick run — server only | `pnpm --filter @counter-attack/server test`                          |
| Full suite command      | `pnpm test` (runs -r across all packages)                            |

### Phase Requirements → Test Map

| Req ID  | Behaviour                                           | Test Type          | Automated Command                                                 | File Exists?                              |
| ------- | --------------------------------------------------- | ------------------ | ----------------------------------------------------------------- | ----------------------------------------- |
| DICE-01 | Dice generated server-side via crypto.randomInt     | unit               | `pnpm --filter @counter-attack/server test -- --reporter=verbose` | Partial — diceUtils.ts is new             |
| DICE-02 | game:roll triggers roll + broadcast to both clients | integration        | `pnpm --filter @counter-attack/server test`                       | Partial — game.integration.test.ts exists |
| SHOT-05 | GK catch → choice of kick/throw/movement            | unit + integration | Both test files                                                   | Partial                                   |
| DICE-03 | Combined score = attribute + dice                   | unit               | `pnpm --filter @counter-attack/shared test`                       | YES — scoreUtils.test.ts                  |
| DICE-04 | -2 cap on cumulative penalties                      | unit               | `pnpm --filter @counter-attack/shared test`                       | YES — scoreUtils.test.ts                  |
| DICE-05 | Loose Ball direction + distance rolls               | unit               | `pnpm --filter @counter-attack/shared test`                       | YES — scoreUtils.test.ts                  |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green (all packages) before marking phase complete

### Wave 0 Gaps (test files to create or extend)

- [ ] `packages/server/src/__tests__/diceUtils.test.ts` — unit tests for `rollDice()`:
  - Returns integer 1–6
  - At least 3 distinct values across 20 rolls (statistical, non-flaky)
- [ ] `packages/server/src/__tests__/gameEngine.test.ts` — EXTEND (file exists) with:
  - `applyRoll` happy paths for PASS, SHOT, HEADER, LOOSE_BALL phases
  - `applyGKRestart` happy paths for kick, throw, movement choices
  - Phase guard rejections
  - D-13: tie shot duel produces LOOSE_BALL outcome
- [ ] `packages/shared/src/shotValidator.test.ts` — UPDATE existing test:
  - Change tie test from expecting SAVE to expecting LOOSE_BALL (D-13)
  - Add test: `outcome === 'LOOSE_BALL'` when scores equal
- [ ] `packages/shared/src/teams.test.ts` — UPDATE existing test:
  - Add `'highPass'` to ATTRIBUTES array
  - Handle `aerialAbility: 0` and `handling: 0` for non-GK roles (adjust >= 1 assertion)
- [ ] `packages/server/src/__tests__/game.integration.test.ts` — EXTEND (file exists) with:
  - game:roll in PASS phase → game:state received by both clients
  - game:gk-restart with each choice → correct phase transition

---

## Security Domain

`security_enforcement` is not set in `.planning/config.json` — treat as enabled.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                         |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------- |
| V2 Authentication     | No      | Phase 5 has no auth changes                                                                              |
| V3 Session Management | No      | Session system unchanged from Phase 3                                                                    |
| V4 Access Control     | Yes     | `game:roll` and `game:gk-restart` must reject wrong-team sockets; established isProcessing mutex pattern |
| V5 Input Validation   | Yes     | `game:gk-restart` payload `choice` must be validated as one of `'kick'                                   | 'throw' | 'movement'` server-side; no client input is trusted |
| V6 Cryptography       | Yes     | `crypto.randomInt` (CSPRNG) used for all dice; `Math.random()` strictly forbidden per D-08               |

### Known Threat Patterns

| Pattern                                            | STRIDE                 | Standard Mitigation                                                                     |
| -------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| Client sends `game:roll` when it's not their turn  | Tampering              | `isActivePlayer()` guard in handler; WRONG_TEAM error + snap-back broadcast             |
| Client sends `game:gk-restart` as non-GK team      | Tampering              | `controlsGKTeam()` guard; WRONG_TEAM error                                              |
| Client sends invalid `choice` in `game:gk-restart` | Tampering              | Validate `choice` against `['kick','throw','movement']` before routing; emit GAME_ERROR |
| Client sends `game:roll` in wrong phase            | Spoofing               | Phase guard check; WRONG_PHASE error + snap-back                                        |
| Double-click race on `game:roll`                   | Denial of Service      | `isProcessing` mutex; second event silently dropped (SC-5 pattern)                      |
| `Math.random()` usage for dice                     | Information Disclosure | Use `crypto.randomInt` only; enforce via code review and grep check                     |

---

## Assumptions Log

| #   | Claim                                                                                                  | Section               | Risk if Wrong                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------- |
| A1  | `computeLooseBall` in `scoreUtils.ts` does not need boundary clamping (pitch boundary deferred)        | Architecture Patterns | Loose Ball may land off-pitch; Phase 6 must add clamping when real pitch coordinates are available |
| A2  | Recommended `highPass` values (DEF 3–5, MID 5–7, FWD 4–6) represent reasonable game balance            | Code Examples         | Squad values may feel wrong in gameplay; adjustable without code change                            |
| A3  | STEAL_ATTEMPT in `applyMove` uses threshold `>= 4` (current stub comment says `dice >= 4 ? 'SUCCESS'`) | Common Pitfalls       | Steal success rate may be wrong vs rulebook; verify against rulebook when replacing stub           |

---

## Open Questions

1. **`aerialAbility: 0` vs existing outfielder values**
   - What we know: D-05 says outfielders have `aerialAbility: 0` in practice. Existing `teams.ts` has outfielders with values 4–7. `teams.test.ts` asserts `>= 1` for all attributes.
   - What's unclear: Should we change all outfielder `aerialAbility` to 0 now (breaking the existing test assertion), or leave existing values and only enforce the convention for new uses?
   - Recommendation: Change to 0 and update the test to allow 0 for `aerialAbility` and `handling` on non-GK roles. This is the correct modelling of the game. Accept the test update cost.

2. **STEAL_ATTEMPT dice threshold (from `stubDice` comment)**
   - What we know: `applyMove` has `// Phase 4 deterministic: stubDice()==3, so combined < threshold => FAIL.` — suggesting threshold is `>= 4` (dice + attribute or just dice?). The rulebook says "roll 6 or combined 10+".
   - What's unclear: The stub implies the combined score approach (attribute + dice >= 10), but the implementation only checks `dice >= 4` as a placeholder.
   - Recommendation: When replacing `stubDice()` in the steal path, implement the full "combined 10+" logic matching the MOVE-04 requirement. Use `computeCombinedScore(defender.tackling, dice, [])` vs threshold 10.

3. **`gkTeam` state for GK_RESTART authorization**
   - What we know: `game:gk-restart` must validate the emitting socket is the GK's team. There is no explicit `gkTeam` field in `GameState`.
   - What's unclear: Best way to track which team's GK has the ball during GK_RESTART phase.
   - Recommendation: When transitioning to `GK_RESTART` phase, set `ball.carrierId` to the GK's `id`. The handler can then look up `ball.carrierId → piece.teamId` to validate. This avoids adding a new field to `GameState`.

---

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: Node.js docs]` — `crypto.randomInt(min, max)` API at nodejs.org/api/crypto.html; used in project at `gameEngine.ts` line 15 and line 81–82 for coin flip and leniency.
- Codebase direct read — `packages/shared/src/types.ts`, `passValidator.ts`, `shotValidator.ts`, `headingValidator.ts`, `scoreUtils.ts`, `teams.ts`, `events.ts`, `hex.ts`
- Codebase direct read — `packages/server/src/gameEngine.ts`, `gameHandlers.ts`, `roomStore.ts`
- Codebase direct read — all existing test files (shotValidator.test.ts, scoreUtils.test.ts, teams.test.ts, gameEngine.test.ts, game.integration.test.ts)
- `.planning/phases/05-dice-resolver-all-resolution-branches/05-CONTEXT.md` — all locked decisions D-01 through D-28 read directly

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — accumulated pitfalls and locked decisions (isProcessing, axial coordinates, ARCH-04)
- `.planning/REQUIREMENTS.md` — DICE-01, DICE-02, SHOT-05 traced to Phase 5

### Tertiary (LOW confidence)

- Recommended `highPass` attribute values for squad members — [ASSUMED] based on game balance reasoning; not verified against physical rulebook

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; existing stack fully verified
- Architecture: HIGH — all patterns directly observed in codebase; no new patterns introduced
- Validator changes: HIGH — source code read directly; changes are surgical
- Pitfalls: HIGH — derived from direct codebase reading (test assertions, TODO comments, discriminated unions)
- `highPass` attribute values: LOW — assumed; user can adjust freely

**Research date:** 2026-05-30
**Valid until:** 2026-07-30 (stable game logic; no fast-moving dependencies)
