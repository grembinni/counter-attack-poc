# Phase 5: Dice Resolver + All Resolution Branches - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all deterministic stubs with server-side `crypto.randomInt` dice and wire every stochastic resolution branch end-to-end: pass accuracy (High Pass, Long Ball), shot/save duels, heading duels, Loose Ball direction+distance, and the GK restart choice (kick / quick throw / movement phase). After this phase, a complete action sequence — movement → pass → shot → save → GK restart — resolves correctly on the server and broadcasts final state to both clients.

**Out of scope for Phase 5:**

- Client rendering of dice rolls and resolution animations (Phase 6–7)
- Match lifecycle: action counter, added time, half transitions (Phase 8)
- Fouls, bookings, injuries, set pieces (out of scope for v1)
- Corner kicks, throw-ins, free kicks (out of scope for v1)

</domain>

<decisions>
## Implementation Decisions

### Rules Version

- **D-01** [informational]: Hybrid rules: boxed game rulebook (2019) as the verified ground truth, with specific v1.4.1 Reference Rulebook additions retained where they add strategic depth. Conflicts default to the boxed rulebook.
- **D-02** [informational]: Retained from v1.4.1 (not in boxed rulebook): long ball accuracy check (9+ same third, 10+ cross-third), GK restart three-option choice (kick/throw/movement), GK kick accuracy check (High Pass rules), handling attribute for post-save catch/spill check.
- **D-03** [informational]: Applied from boxed rulebook (corrects prior assumptions): `highPass` is a named player attribute; duel ties produce Loose Ball. Inaccurate High Pass continues to produce Loose Ball (same as Long Pass — existing behaviour is correct). Effects implemented via D-04 through D-17.

### Player Attribute Corrections

- **D-04:** Add `highPass: number` to `PlayerPiece` in `packages/shared/src/types.ts`. This is the attribute used for High Pass accuracy checks (not `aerialAbility`). Outfielders have meaningful `highPass` values; GKs have `highPass: 0`.
- **D-05:** `aerialAbility` stays on `PlayerPiece` and remains **GK-only** in practice (outfielders have `aerialAbility: 0`). Used for GK competing for high crosses/headers in heading duels.
- **D-06:** `handling` stays on `PlayerPiece` (v1.4.1 retention). Used in `validateHandlingCheck` for post-save catch/spill. GKs have a meaningful value; outfielders have `handling: 0`.
- **D-07:** Update `packages/shared/src/teams.ts` to add realistic `highPass` values to all outfielders. GKs already have `aerialAbility`; set their `highPass: 0`.

### Crypto Dice

- **D-08:** All dice generated exclusively by `crypto.randomInt(1, 7)` on the server (`packages/server`). Zero random number generation in `packages/client` or `packages/shared`. DICE-01.
- **D-09:** A `rollDice()` helper is added to `packages/server/src/diceUtils.ts` (or similar). Pure wrapper around `crypto.randomInt`. Injected into validator calls — validators never roll their own dice.

### game:roll Event and Broadcast

- **D-10:** Single-broadcast model: `game:roll` triggers the server to roll dice, apply the outcome, and broadcast one `game:state` with both `lastDiceRoll` embedded in state and the outcome applied. No intermediate "dice pending" state, no second client event needed.
- **D-11:** Add `lastDiceRoll?: { rolls: number[]; context: string }` to `GameState` in `types.ts`. The client displays this to show players what was rolled before rendering the result.
- **D-12:** `game:roll` is only valid from the active player when `GameState.phase` is a dice-requiring phase (`PASS` accuracy, `SHOT`, `HEADER`, `LOOSE_BALL`, `GK_RESTART` kick). Server rejects with `game:error` otherwise.

### Tie Handling

- **D-13:** Shot and heading duel ties produce **Loose Ball**. The server does not loop to re-roll on ties — a tie is a distinct outcome that resolves as Loose Ball. Update `validateShotDuel` to return `{ outcome: 'LOOSE_BALL' }` on tie (replacing the current SAVE-on-tie behaviour).

### Pass Accuracy Fixes

- **D-14:** Fix `validatePassAccuracy` in `passValidator.ts`: change `piece.aerialAbility` → `piece.highPass` for the HIGH pass case.
- **D-15:** Inaccurate High Pass → **Loose Ball** (same as Long Pass). The existing `passValidator.ts` behaviour (`triggerLooseBall: true`) is correct and stays unchanged.
- **D-16:** `AccuracyResult` does not need to distinguish High vs Long Pass inaccuracy — both produce `{ accurate: false; triggerLooseBall: true }`. No change to the discriminated union.

### Shot Duel Corrections

- **D-17:** Update `validateShotDuel` return type: add `{ outcome: 'LOOSE_BALL' }` for ties; remove the "ties go to GK" comment. Signature stays the same; behaviour changes on `shooterScore === gkScore`.
- **D-18:** SHOT-03 (auto-miss on dice roll of 1) and SHOT-04 (GK dive -1 penalty at 3rd hex) are **advanced rules**. They are already implemented and should remain — they add depth and are already tested. Do not remove.

### Loose Ball Resolution

- **D-19:** Loose Ball uses two dice rolls: direction (1-6 → one of six hex axial directions) and distance (1-6 hexes). Both rolls are made server-side with `crypto.randomInt`. DICE-03, DICE-04, DICE-05.
- **D-20:** A `resolveLoseBall(incidentHex, directionRoll, distanceRoll)` pure function is added to `packages/shared/src` (or server-side if it needs state). It maps direction (1-6) to one of the six axial hex directions and walks `distanceRoll` hexes from the incident hex.
- **D-21:** After Loose Ball position is computed, `GameState.ball.position` is updated to the Loose Ball landing hex and `ball.carrierId` is set to `null`. Phase transitions to `MOVEMENT` (attacker who caused the loose ball gets possession and Movement Phase begins).

### GK Restart

- **D-22:** GK restart uses a **single event**: `game:gk-restart` with payload `{ choice: 'kick' | 'throw' | 'movement' }`. Add to `ClientEvents` and `ClientToServerEvents` in `events.ts`.
- **D-23:** GK restart is only valid when `GameState.phase === 'GK_RESTART'` and the emitting player is the GK's team.
- **D-24:** GK kick = High Pass rules applied from the GK's position: GK's `highPass` attribute + dice roll ≥ 8 for accuracy. If inaccurate, Loose Ball from the intended target hex (same as D-15). GK may not kick into the opposite final third (box rule).
- **D-25:** GK quick throw = Standard Pass distance (max 11 hexes), uninterceptable. No accuracy check.
- **D-26:** GK movement = GK's team starts a Movement Phase immediately (no dice needed). `GameState.phase` transitions to `MOVEMENT`, `attackingTeam` = GK's team.

### Heading Duel

- **D-27:** Heading duel follows the rulebook: both challengers roll + heading attribute; higher wins (ties → Loose Ball per D-13). If attacker wins against a defender, the attacker's heading combined score is locked; GK then rolls once + saving and the attacker's locked score is compared. Attacker does not re-roll for the GK save attempt.
- **D-28:** GK competing for a high cross uses `aerialAbility` (not `saving`). If GK wins the aerial duel against an attacker, GK catches (transitions to GK_RESTART). If attacker wins, it's a goal.

### Claude's Discretion

- Direction mapping for Loose Ball direction rolls 1–6: Claude picks a deterministic axial mapping (e.g., 1 = +q, 2 = -q, 3 = +r, 4 = -r, 5 = +q-r, 6 = -q+r) and documents it as a constant.
- `lastDiceRoll` field shape in `GameState`: Claude defines the exact structure.
- `resolveLoseBall` placement (shared vs server): Claude decides based on whether it needs access to `GameState.pieces` for boundary clamping.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Rules Source

- `c:\Users\jerem\Downloads\rule-book-new.pdf` — Official boxed game rulebook (Webstar Games 2019). Ground truth for all dice mechanics verified in this discussion. Key pages: p14-15 (passes), p18-19 (shooting/GK), p21-22 (heading), p7 (ZoI).

### Shared Types and Validators (files that will be modified)

- `packages/shared/src/types.ts` — `PlayerPiece` (add `highPass`), `GameState` (add `lastDiceRoll`), `GamePhase` (add `GK_RESTART` already present). Read before touching.
- `packages/shared/src/passValidator.ts` — `validatePassAccuracy` uses wrong attribute (aerialAbility → highPass); `AccuracyResult` union needs a new branch for inaccurate HIGH pass. Read before modifying.
- `packages/shared/src/shotValidator.ts` — `validateShotDuel` ties currently go to SAVE; must change to LOOSE_BALL. Read before modifying.
- `packages/shared/src/headingValidator.ts` — Existing heading duel logic. Read before wiring.
- `packages/shared/src/scoreUtils.ts` — `computeCombinedScore` (attribute + dice, -2 cap). Used by all duel validators. Do not modify.
- `packages/shared/src/teams.ts` — Hardcoded squads. Add `highPass` attribute values to all outfielders; set `highPass: 0` on GKs.

### Phase 4 Integration Points

- `packages/server/src/gameHandlers.ts` — Existing `game:move`, `game:end-turn`, `game:undo` handlers. Phase 5 adds `game:roll` and `game:gk-restart` handlers here (or a new file following the same pattern).
- `packages/server/src/roomStore.ts` — `broadcastState(io, room)` — single broadcast entry point. Phase 5 calls it after every dice resolution.
- `packages/shared/src/events.ts` — Add `GAME_ROLL` (already present but untyped), `GAME_GK_RESTART` to `ClientEvents`. Add `game:gk-restart` to `ClientToServerEvents`.

### Requirements

- `.planning/REQUIREMENTS.md` §Dice — DICE-01, DICE-02 (crypto dice, game:roll event), DICE-03, DICE-04, DICE-05 (Loose Ball)
- `.planning/REQUIREMENTS.md` §Shots — SHOT-01, SHOT-02, SHOT-03, SHOT-04, SHOT-05, SHOT-06
- `.planning/REQUIREMENTS.md` §Passes — PASS-03 (High Pass accuracy), PASS-04 (Long Pass accuracy)
- `.planning/ROADMAP.md` §Phase 5 — success criteria 1–5

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `computeCombinedScore(attribute, diceValue, penalties)` in `scoreUtils.ts` — handles the -2 cap. All duel validators already use it. Phase 5 calls it for every new duel branch; do not bypass.
- `validateHandlingCheck(gk, diceValue)` in `shotValidator.ts` — already correct for v1.4.1 (handling attribute threshold). Phase 5 wires the call site; function stays as-is.
- `validateGKDive(gk, distance)` in `shotValidator.ts` — returns `savingPenalty` (-1 at 3rd hex). Phase 5 feeds this penalty into `validateShotDuel`.
- `validateHeading(...)` in `headingValidator.ts` — existing heading duel logic. Phase 5 extends the caller to handle the GK case (aerialAbility instead of heading) and locked-score comparison.
- `isUnderZoI()` / `hexDistance()` in `hex.ts` — needed for identifying nearest defender after inaccurate high pass.
- `broadcastState(io, room)` in `roomStore.ts` — Phase 5 calls this after every resolved dice action, same as Phase 4 does.

### Established Patterns

- **Dice injection**: validators never generate dice. Phase 5 continues this — `rollDice()` lives in server/src, results passed into validators as arguments.
- **Discriminated union results**: `validateShotDuel` → `ShotDuelResult`, `validatePass` → `PassResult`. New resolution functions follow the same pattern.
- **Named exports, no defaults** — All modules use named exports.
- **`.js` extensions on local imports** — NodeNext module resolution.
- **Guard-first early returns** — Established across all validators.
- **isProcessing mutex** — Already on Room type. Phase 5 handlers must set/clear it identically to Phase 4's `game:move` handler.

### Integration Points

- `game:roll` handler: lives in `gameHandlers.ts` alongside existing `game:move`. Reads `GameState.phase` to determine which resolution branch to invoke.
- `game:gk-restart` handler: new handler in `gameHandlers.ts`. Validates `phase === 'GK_RESTART'` and emitting player is GK team. Dispatches to kick/throw/movement branch.
- `GameState.phase` FSM transitions Phase 5 adds: `PASS → SHOT`, `SHOT → GOAL | LOOSE_BALL | GK_RESTART`, `GK_RESTART → MOVEMENT | (kick → HEADER?) | (throw → MOVEMENT)`, `HEADER → GOAL | LOOSE_BALL | MOVEMENT`.

</code_context>

<specifics>
## Specific Ideas

- **Tie → Loose Ball** (user decision): Rather than re-rolling on tied duels, a tie in any duel (shot, heading) is treated as a Loose Ball from the incident hex. This is a deliberate simplification that makes ties meaningful and avoids complex re-roll loops.
- **Inaccurate High Pass → nearest defender header**: The defender nearest the intended target (if multiple, the one closest to the attacking goal) gets a heading opportunity. The existing `hexDistance` utility resolves this.
- **GK kick accuracy**: Uses the same `validatePassAccuracy(gk, 'HIGH', dice, [])` call path — the GK's `highPass` attribute (should be low/0) means GK kicks are unlikely to be accurate, making the quick throw a meaningful alternative.
- **Single broadcast for dice results**: `lastDiceRoll` is embedded in `GameState` so both clients can display what was rolled before the board state visually updates. Client can show a dice animation layer on top.

</specifics>

<deferred>
## Deferred Ideas

- **MOVE-07 (snapshot during movement)**: The Phase 4 moveValidator already detects SNAPSHOT_AVAILABLE. Phase 5 resolves the snapshot duel when the user triggers it during movement.
- **Advanced rules**: tackles from behind (foul on 1 or 2), extra yard injury risk, difficult-angle shooting penalties — all flagged as advanced rules in the boxed rulebook. Deferred to v2 per project scope.
- **GK kick range restriction**: Box rulebook says GK may not kick into the opposite final third. Phase 5 enforces this. If the user's chosen target is in the opposite final third, `game:error` is returned.
- **GK quick-throw ball delivery to a chosen target hex (D-25 full intent)**: In v1 the `throw` choice is implemented as a movement-phase start with the ball held by the GK (engine-equivalent to the `movement` choice); the ball's destination is resolved implicitly in the subsequent movement phase. D-25's full intent — placing the ball up to 11 hexes away on the throw itself — requires a `targetHex` parameter on `game:gk-restart` and a ≤11-hex distance validation. This is deferred to Phase 7 client integration, when the click-to-target UI is built. The `throw` and `movement` branches are kept distinct in the engine so Phase 7 only has to extend the `throw` branch with targetHex delivery, not reintroduce it.

</deferred>

---

_Phase: 5-dice-resolver-all-resolution-branches_
_Context gathered: 2026-05-30_
