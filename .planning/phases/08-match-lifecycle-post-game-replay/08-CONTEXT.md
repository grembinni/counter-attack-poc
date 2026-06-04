# Phase 8: Match Lifecycle + Post-Game Replay - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a complete, rules-correct match from first kick-off through two 45-minute halves with added time, full-time detection, and an automatic post-game replay. After this phase, two players can play a full match from kick-off setup → first half → half-time → second half → full-time → replay.

**In scope:**

- Time-based action counting (actionCount in minutes, per v1.4.1 timing rules)
- Action sequence enforcement (lastActionType + eligibility table validation)
- KICK_OFF_SETUP phase: free piece repositioning + "Ready" confirmation before each kick-off
- Half-time flow: HALF_TIME pause → "Start 2nd Half" button → second-half kick-off by opposing team
- Added time: inline server roll (dice + refereeCard.leniency) when actionCount crosses 45
- Full-time detection: FULL_TIME state with final score
- Post-game replay: server streams event log as game:state frames at 1 event/second
- Snapshot implementation: applySnapshot in gameEngine.ts (SNAP-01..03)

**Out of scope for Phase 8:**

- Tiebreakers / extra time / penalties — draw is valid, match ends at final score
- Fouls, bookings, throw-ins, corners, free kicks (all deferred to v2 per REQUIREMENTS.md)
- Replay pause/scrub controls — auto-play only
- Persistent room reuse for rematches — "Play Again" returns to create/join lobby

</domain>

<decisions>
## Implementation Decisions

### Full-Time Resolution

- **D-01:** Draw is valid — if scores are level at full time, the match ends. No extra time or penalty shootout in v1.
- **D-02:** Referee card `leniency` affects ONLY added time calculation: `addedTime = diceRoll + refereeCard.leniency`. No other effect in v1. Resolves the STATE.md open question.

### Match Clock (Time-Based Action Counting)

- **D-03:** `actionCount` tracks **minutes elapsed**, not a simple action tally. The half ends when `actionCount >= 45` (plus any added time). Time costs per action type from Counter Attack rulebook v1.4.1:

  | Action                          | Minutes |
  | ------------------------------- | ------- |
  | Movement Phase (full 4-5-2)     | +3      |
  | Standard Pass                   | +1      |
  | High Pass                       | +1      |
  | Long Ball                       | +1      |
  | GK Kick (restart choice)        | +1      |
  | First-time Pass                 | +0      |
  | Shot                            | +0      |
  | Header                          | +0      |
  | Quick Throw (GK restart choice) | +0      |
  | Snapshot                        | +0      |
  | Loose Ball (Deflection)         | +0      |

- **D-04:** The entire 4-5-2 Movement Phase (all 3 slots: ATTACKER_4 → DEFENDER_5 → ATTACKER_2) = 1 action = 3 minutes. The clock increments when ATTACKER_2 ends (the MOVEMENT→PASS transition in `applyEndTurn`). A steal that ends the phase early still counts as the full 3-minute movement action.

- **D-05:** When `actionCount >= 45`, the server immediately rolls added time **inline on the same transition**: `addedTime = crypto.randomInt(1, 7) + state.refereeCard.leniency`. The result is stored in `GameState.addedTime`. No client interaction required. Play continues until `actionCount >= 45 + addedTime`, then HALF_TIME / FULL_TIME is triggered.

- **D-06:** New `GameState` fields required:
  - `addedTime: number | null` — null until the half reaches 45 min; set once and never re-rolled for the same half.
  - `lastActionType: LastActionType | null` — set after every action; null at match start and after each kick-off.
  - `kickOffTeam: 'home' | 'away'` — records which team kicked off in the first half; determines second-half assignment.

  New type `LastActionType`:

  ```typescript
  type LastActionType =
    | 'MOVEMENT_PHASE'
    | 'SUCCESSFUL_TACKLE'
    | 'STANDARD_PASS'
    | 'FIRST_TIME_PASS'
    | 'HIGH_PASS'
    | 'LONG_BALL'
    | 'HEADER'
    | 'DEFLECTION'
    | 'SNAPSHOT'
    | 'SHOT';
  ```

### Action Sequence Enforcement

- **D-07:** Phase 8 enforces the full action eligibility table from Counter Attack rulebook v1.4.1. `lastActionType` is stored in `GameState` and every server action handler validates the proposed next action against the table before accepting it. Invalid sequences return `{ ok: false, reason: 'INVALID_SEQUENCE' }`.

- **D-08:** Corrected action eligibility table (✓ = valid next action):

  | Last action ↓ / Next →  | Movement | Std Pass | FT Pass | High Pass | Long Ball | Header | Snapshot | Shot |
  | ----------------------- | -------- | -------- | ------- | --------- | --------- | ------ | -------- | ---- |
  | Successful tackle       | ✓        | ✓        | ✗       | ✓         | ✓         | ✗      | ✓        | ✗    |
  | Movement phase          | ✓        | ✓        | ✗       | ✓         | ✓         | ✗      | ✓        | ✓    |
  | Standard pass           | ✓        | ✗        | ✓       | ✗         | ✗         | ✗      | ✓        | ✗    |
  | First-time pass         | ✓        | ✗        | ✗       | ✗         | ✗         | ✗      | ✓        | ✗    |
  | High pass               | ✗        | ✗        | ✗       | ✗         | ✗         | ✓      | ✗        | ✗    |
  | Long ball               | ✓        | ✗        | ✗       | ✗         | ✗         | ✓      | ✗        | ✗    |
  | Header                  | ✓        | ✗        | ✓       | ✗         | ✗         | ✗      | ✓        | ✗    |
  | Deflection (Loose Ball) | ✓        | ✗        | ✓       | ✗         | ✓         | ✗      | ✓        | ✗    |

  Key rules: High pass MUST be followed by a Header (only valid next action). Shot can ONLY follow a Movement phase. Long ball can lead to Movement or Header only.

- **D-09:** The current FSM goes MOVEMENT → PASS → SHOT (pass always precedes shot). The eligibility table shows this is incorrect for Standard pass → Shot (✗). Phase 8 restructures the FSM so the attacking team can choose their next action after each completed action, validated against this table. The PASS phase name may need to become a more generic "BALL_ACTION" or the client handles type selection before emitting.

### Per-Action Flow Validation

Each action type's complete FSM flow, validation rules, time increment, and `lastActionType` value. The planner must implement each of these in `gameEngine.ts` and the corresponding `gameHandlers.ts` handler.

- **D-10:** **Movement Phase**
  - _Trigger:_ `applyStartMovement` (KICK_OFF → MOVEMENT/ATTACKER_4), or the previous action's resolution transitions phase to MOVEMENT.
  - _Completes:_ `applyEndTurn` closes ATTACKER_2 slot (normal end), OR `applyMove` produces a `STEAL_ATTEMPT SUCCESS` result (early end — see Successful Tackle below).
  - _Time:_ +3 min on completion (in `applyEndTurn` at the ATTACKER_2→null transition).
  - _Sets lastActionType:_ `'MOVEMENT_PHASE'` on normal end; `'SUCCESSFUL_TACKLE'` on steal.
  - _Sequence guard:_ valid after any `lastActionType` except `'HIGH_PASS'` (High pass must be headed, never followed by movement). Server rejects `game:start-movement` if `lastActionType === 'HIGH_PASS'`.
  - _Next actions allowed:_ Movement ✓, Std Pass ✓, High Pass ✓, Long Ball ✓, Snapshot ✓, Shot ✓ (FT Pass ✗, Header ✗).

- **D-11:** **Standard Pass**
  - _Trigger:_ `game:pass` event with `type: 'STANDARD'` while `phase === 'PASS'` (or new action-choice state — see D-09).
  - _Flow:_ accuracy check via `validatePassAccuracy(carrier, 'STANDARD', dice, penalties)`; accurate → possession transfers to target hex area, phase → new action choice for new ball carrier; inaccurate → LOOSE_BALL.
  - _Time:_ +1 min on pass declaration (when the `game:pass` event is accepted, before dice roll).
  - _Sets lastActionType:_ `'STANDARD_PASS'`.
  - _Sequence guard:_ valid only when `lastActionType` ∈ `{MOVEMENT_PHASE, SUCCESSFUL_TACKLE}`. Server rejects otherwise.
  - _Next actions allowed:_ Movement ✓, FT Pass ✓, Snapshot ✓ (Std Pass ✗, High Pass ✗, Long Ball ✗, Header ✗, Shot ✗).

- **D-12:** **First-time Pass**
  - _Trigger:_ `game:pass` with `type: 'FIRST_TIME'`.
  - _Flow:_ accuracy check (PASS-02: same as Standard Pass mechanics but 6-hex range); each team moves 1 player 1 hex during flight (server resolves as a pre-approved mini-move, or defers to client selection — planner to decide); inaccurate → LOOSE_BALL.
  - _Time:_ +0 min.
  - _Sets lastActionType:_ `'FIRST_TIME_PASS'`.
  - _Sequence guard:_ valid only when `lastActionType === 'STANDARD_PASS'`. Server rejects otherwise.
  - _Next actions allowed:_ Movement ✓, Snapshot ✓ (all others ✗).

- **D-13:** **High Pass**
  - _Trigger:_ `game:pass` with `type: 'HIGH'`.
  - _Flow:_ accuracy check (PASS-03: carrier.highPass + dice >= 8); each team moves 1 player up to 3 hexes during flight; inaccurate → LOOSE_BALL.
  - _Time:_ +1 min.
  - _Sets lastActionType:_ `'HIGH_PASS'`.
  - _Sequence guard:_ valid when `lastActionType` ∈ `{MOVEMENT_PHASE, SUCCESSFUL_TACKLE}`. Server rejects otherwise. Additionally: cannot be made if an opponent is adjacent to the carrier AND in the pass path (PASS-03).
  - _Critical rule:_ High Pass MUST be followed by a Header. `lastActionType === 'HIGH_PASS'` means the server will ONLY accept `game:header` as the next action — all other action events are rejected with `INVALID_SEQUENCE`.
  - _Next actions allowed:_ Header ONLY ✓.

- **D-14:** **Long Ball**
  - _Trigger:_ `game:pass` with `type: 'LONG'`.
  - _Flow:_ accuracy check (PASS-04: 9+ same third, 10+ across final thirds); cannot land within 5 hexes of own players or adjacent to an opponent; inaccurate → LOOSE_BALL.
  - _Time:_ +1 min.
  - _Sets lastActionType:_ `'LONG_BALL'`.
  - _Sequence guard:_ valid when `lastActionType` ∈ `{MOVEMENT_PHASE, SUCCESSFUL_TACKLE}`. Server rejects otherwise.
  - _Next actions allowed:_ Movement ✓, Header ✓ (all others ✗).

- **D-15:** **Header**
  - _Trigger:_ `game:header` event (new Socket.io event) while `phase === 'HEADER'`.
  - _Flow:_ `applyRoll` HEADER branch (already implemented): attacker vs nearest defender (HEAD-01 range rules); uncontested = auto-win (HEAD-02); GK aerial challenge on attacker win (D-28); outcomes: GOAL → KICK_OFF_SETUP, GK_RESTART, LOOSE_BALL (tie), or MOVEMENT (defender wins).
  - _Time:_ +0 min.
  - _Sets lastActionType:_ `'HEADER'`.
  - _Sequence guard:_ valid ONLY when `lastActionType` ∈ `{HIGH_PASS, LONG_BALL}`. Server rejects `game:header` if `lastActionType` is anything else.
  - _Next actions allowed:_ Movement ✓, FT Pass ✓, Snapshot ✓ (Header ✗ per HEAD-04 — no consecutive headed passes; all others ✗).

- **D-16:** **Snapshot**
  - _Trigger:_ `game:snapshot` event (new) — declared by the ball carrier when either: (a) in `phase === 'MOVEMENT'` and ball is in the opponent's penalty area (SNAP-01), or (b) immediately after any pass resolves accurately (SNAP-01 second clause).
  - _Flow:_ opponent moves 1 player up to 2 hexes (deflection attempt, SNAP-02); then transitions to `phase === 'SHOT'` with -1 dice penalty applied to the shot. All standard shot rules apply (SNAP-03).
  - _Time:_ +0 min.
  - _Sets lastActionType:_ `'SNAPSHOT'` on declaration. After the ensuing shot resolves, `lastActionType` follows the shot resolution (goal → reset to null via KICK_OFF_SETUP; miss/save → MOVEMENT/GK_RESTART as normal).
  - _Sequence guard:_ valid when `lastActionType` ∈ `{MOVEMENT_PHASE, SUCCESSFUL_TACKLE, STANDARD_PASS, FIRST_TIME_PASS, HIGH_PASS, LONG_BALL, HEADER, DEFLECTION}` — i.e., Snapshot appears as valid in most rows of the eligibility table. Plus the positional rule (ball in penalty area, or immediately post-pass).
  - _Next actions allowed:_ N/A — Snapshot immediately transitions to SHOT; the Shot's outcome determines what follows.

- **D-17:** **Shot**
  - _Trigger:_ `game:roll` while `phase === 'SHOT'` (the shot declaration is implicit — entering SHOT phase IS the declaration, which may come from Movement Phase directly or via Snapshot).
  - _Flow:_ `applyRoll` SHOT branch (already implemented): shooter vs GK duel; outcomes: GOAL → KICK_OFF_SETUP, MISS → MOVEMENT, LOOSE_BALL (tie) → LOOSE_BALL phase, SAVE → GK_RESTART.
  - _Time:_ +0 min.
  - _Sets lastActionType:_ not applicable — Shot always leads to a state that resets `lastActionType` to `null` (KICK_OFF_SETUP after goal) or a new action sequence (MOVEMENT, GK_RESTART, LOOSE_BALL each set their own `lastActionType`).
  - _Sequence guard:_ Phase 8 adds the guard that `phase` can only enter SHOT from MOVEMENT (via `lastActionType === 'MOVEMENT_PHASE'`) or from SNAPSHOT. A Shot cannot follow any pass type directly. Server must reject transitions into SHOT phase that come from pass resolution (break from current FSM behaviour).
  - _Next actions:_ Shot does not appear as a "last action" row in the table — its outcomes always reset the sequence.

- **D-18:** **Successful Tackle** (outcome, not a player-triggered action)
  - _Occurs:_ when `applyMove` produces a `STEAL_ATTEMPT SUCCESS` inside the Movement Phase. Possession transfers immediately; the Movement Phase ends.
  - _Time:_ +3 min (counted as part of the Movement Phase that contained the tackle).
  - _Sets lastActionType:_ `'SUCCESSFUL_TACKLE'`.
  - _Next actions allowed:_ Movement ✓, Std Pass ✓, High Pass ✓, Long Ball ✓, Snapshot ✓ (FT Pass ✗, Header ✗, Shot ✗).

- **D-19:** **Deflection / Loose Ball** (outcome, not a player-triggered action)
  - _Occurs:_ when `applyRoll` produces a LOOSE_BALL phase from any source (inaccurate pass, tied duel, GK kick spill).
  - _Flow:_ `applyRoll` LOOSE_BALL branch resolves landing hex (already implemented). Ball lands unclaimed; possession is determined by whoever reaches it in the next Movement Phase.
  - _Time:_ +0 min.
  - _Sets lastActionType:_ `'DEFLECTION'` when LOOSE_BALL resolves (after landing is computed).
  - _Next actions allowed:_ Movement ✓, FT Pass ✓, Long Ball ✓, Snapshot ✓ (Std Pass ✗, High Pass ✗, Header ✗, Shot ✗).

- **D-20:** **GK Restart** (kick / throw / movement) — sets `lastActionType` per choice:
  - `'kick'` → `applyGKRestart` kick branch → `lastActionType = 'STANDARD_PASS'` (kick is equivalent to a Long Ball / High Pass for sequence purposes — planner to determine correct mapping; a GK kick that is accurate leads to MOVEMENT, so treat as equivalent to movement following it; use `'MOVEMENT_PHASE'` after kick resolves to MOVEMENT).
  - `'throw'` → `applyGKRestart` throw branch → `lastActionType = 'STANDARD_PASS'` (quick throw = uninterceptable standard pass; valid next actions as per Standard Pass row).
  - `'movement'` → GK team starts MOVEMENT; `lastActionType = null` (same as normal kick-off start).

  _Time increment:_ kick = +1 min (D-03); throw/movement = +0 min.

### Snapshots

- **D-21:** Snapshots (SNAP-01, SNAP-02, SNAP-03) are **in scope for Phase 8**. `applySnapshot` to be implemented in `packages/server/src/gameEngine.ts`. Snapshot conditions: ball-carrier is in the opponent's penalty area during a Movement Phase (SNAP-01); or immediately after any pass inside or outside the box. Snapshot applies -1 dice penalty to Shooting (SNAP-02); before the shot, 1 opponent moves any player up to 2 hexes for a deflection attempt. Snapshot = 0 minutes. No new FSM state required — snapshot transitions to SHOT.

### Kick-Off Procedure

- **D-22:** New `KICK_OFF_SETUP` phase added to `GamePhase`. Both teams enter this phase before each kick-off (match start, goals, half-time start). Both teams freely reposition their 11 players to any valid hex in their permitted zone — no pace limits apply (this is pre-game/pre-restart positioning, not a movement action):
  - Attacking team: own half (q ≤ 18 for home, q ≥ 18 for away) **plus** the centre circle hexes
  - Defending team: own half only; must be **outside** the centre circle (hexDistance > 3 from kickOffHex {q:18, r:13})
  - Pieces reset to 4-5-2 formation positions from `packages/shared/src/teams.ts` as the default before repositioning begins.

- **D-23:** Each team clicks a "Ready" button (or equivalent) to confirm their positioning. Server transitions from `KICK_OFF_SETUP` to `KICK_OFF` only when **both** teams have confirmed ready. Server validates placement rules on "Ready" — rejects if constraints are violated.

- **D-24:** The attacking team must manually place exactly one player on the centre hex (`kickOffHex = {q:18, r:13}`). Server rejects the "Ready" confirmation if the centre hex is unoccupied by an attacking player. The client should highlight the centre hex requirement clearly.

- **D-25:** Second half kick-off is taken by the team that did NOT kick off in the first half (MATCH-04). `GameState.kickOffTeam` records the first-half kick-off team. When HALF_TIME transitions to the second half, `attackingTeam` is set to the opposite team.

- **D-26:** The first action after `KICK_OFF_SETUP` → `KICK_OFF` → `MOVEMENT` must be a Standard Pass originating from the centre hex. Server enforces this as MATCH-03.

### Half-Time Flow

- **D-27:** When `actionCount >= 45 + addedTime` at the end of the first half, the server transitions to `HALF_TIME` phase. Both clients render a half-time screen showing the current score and a "Start 2nd Half" button. The button is only enabled for the team that did NOT kick off in the first half (they take the second-half kick-off). Clicking it transitions to `KICK_OFF_SETUP` for the second half.

- **D-28:** `half` in `GameState` increments from `1` to `2` when the second half begins. `actionCount` resets to `0`. `addedTime` resets to `null`.

### Post-Game Replay

- **D-29:** After full time (`actionCount >= 45 + addedTime` at end of second half), server transitions to `FULL_TIME` briefly (shows final score), then automatically starts `REPLAY` phase.

- **D-30:** Replay delivery: server reconstructs `GameState` for each event in the event log (by replaying state transitions from `buildInitialGameState`) and emits `game:state` for each frame at 1-second intervals via `setInterval`. `GameState.phase = 'REPLAY'` tells clients to render the replay screen.

- **D-31:** Replay granularity: **1 second per individual event** in the event log. Each `MOVE` event = 1 replay frame = 1 second. `SLOT_ADVANCE` events are skipped (no board change). `DICE_ROLL`, `STEAL_ATTEMPT`, and `GOAL` events are shown for 1 second each. `KICK_OFF` events shown for 1 second.

- **D-32:** Replay screen shows: board state, final score (persistent), current replay position indicator (e.g., "Action 34 of 127"). When the replay finishes (all events exhausted), both clients see a "Play Again" button. Clicking "Play Again" returns to the create/join lobby screen (clears room state, new session).

### Claude's Discretion

- New `ActionEvent` subtypes needed for actions not yet in the event log (High Pass, Long Ball, First-time Pass, Shot declaration, Snapshot). Claude defines the discriminant shapes in `types.ts`, following the existing ActionEvent union pattern.
- HALF_TIME and FULL_TIME screen layouts — Claude decides visual presentation within the constraint of "shows score + action button."
- KICK_OFF_SETUP client UX — Claude decides how to show valid placement zones (colour tinting) and how the "Ready" button state reflects unmet constraints (e.g., disabled with tooltip "Place a player on the centre hex first").
- Replay setInterval management on the server — Claude handles cleanup (clearInterval on room deletion or player disconnect during replay).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal and Requirements

- `.planning/ROADMAP.md` §Phase 8 — goal, success criteria (5 criteria), UI hint: yes
- `.planning/REQUIREMENTS.md` §Match Structure — MATCH-01, MATCH-02, MATCH-03, MATCH-04, MATCH-05
- `.planning/REQUIREMENTS.md` §Post-Game Replay — REPLAY-01, REPLAY-02, REPLAY-03
- `.planning/REQUIREMENTS.md` §Snapshots — SNAP-01, SNAP-02, SNAP-03 (in scope for Phase 8)

### Rulebook

- `c:\Users\jerem\Downloads\rule-book-new.pdf` — Counter Attack rulebook v1.4.1. Key pages: action sequence table (shows eligible next actions per last action — canonical source for D-07/D-08), match timing rules (D-03), kick-off procedure (MATCH-03), added time (MATCH-02). **Planner MUST read the action sequence and match timing sections before writing plan tasks.**

### Prior Phase Decisions

- `.planning/phases/07.1-ui-cleanup/07.1-CONTEXT.md` — D-01 (4-5-2 formation positions in teams.ts — default kick-off starting positions), D-07/D-08 (SVG overlay for pitch markings — centre circle, penalty boxes already rendered), D-11 (DIFFICULT_ANGLE_HEXES at corner zones)
- `.planning/phases/07-client-server-integration/07-CONTEXT.md` — D-03 (all socket listeners in central App.tsx useEffect), D-11 (no board flip), D-12 (screen routing via Zustand store, no React Router), D-06 (game:shot records target hex — Phase 8 can extend this for snapshot targeting)
- `.planning/phases/06-react-hex-grid-renderer/06-CONTEXT.md` — D-04/D-05 (pitch region boundaries: centre circle = hexDistance ≤ 3 from {q:18,r:13}; home/away halves at q=18), HEX_SIZE=20px, flat-top orientation

### Shared Types and Events (Phase 8 extends these)

- `packages/shared/src/types.ts` — `GameState`, `GamePhase` (HALF_TIME, FULL_TIME, REPLAY already defined), `ActionEvent` union (needs new subtypes for High Pass, Long Ball, Shot, Snapshot), `ActionEventType`. Phase 8 adds `lastActionType`, `addedTime`, `kickOffTeam` fields to `GameState` and new `LastActionType` type.
- `packages/shared/src/events.ts` — `ClientEvents`, `ServerEvents`. Phase 8 adds: `GAME_READY` (kick-off setup confirmation), potentially `GAME_HALF_TIME_START` (trigger second half).
- `packages/shared/src/pitch.ts` — `PITCH_REGIONS.centreCircle`, `PITCH_REGIONS.kickOffHex` — used by KICK_OFF_SETUP placement validation (D-11). `isInRegion()` for zone checks.

### Server Files (Phase 8 modifies these)

- `packages/server/src/gameEngine.ts` — `applyEndTurn` (add +3 min counter, half-time check), `applyRoll` (add per-action time increments, lastActionType updates, sequence validation), `applyGKRestart` (add +1 min for kick, +0 for throw/movement), `buildInitialGameState` (add new fields). New functions: `applySnapshot`, `applyKickOffReady`, `applyHalfTimeStart`, `buildReplayFrames`.
- `packages/server/src/roomStore.ts` — `Room` type may need replay timer handle (`replayTimer: ReturnType<typeof setInterval> | null`). `broadcastState` unchanged — replay uses it to emit frames.
- `packages/server/src/gameHandlers.ts` — new handlers for `game:ready` (kick-off setup), half-time start. Existing handlers updated to validate action sequences.

### Client Files (Phase 8 adds/modifies these)

- `packages/client/src/App.tsx` — add routing for `HALF_TIME`, `FULL_TIME`, `KICK_OFF_SETUP`, `REPLAY` screens (alongside existing `GAME_BOARD`)
- `packages/client/src/store/useGameStore.ts` — `screen` type extended with new screen values
- `packages/client/src/components/GameBoard.tsx` — score display already present (no change)
- New components needed: `KickOffSetupScreen.tsx`, `HalfTimeScreen.tsx`, `FullTimeScreen.tsx`, `ReplayScreen.tsx`

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `buildInitialGameState` (`gameEngine.ts:72`) — baseline constructor; Phase 8 adds `addedTime: null`, `lastActionType: null`, `kickOffTeam: attackingTeam` fields.
- `applyEndTurn` (`gameEngine.ts:280`) — ATTACKER_2 → PASS transition is the primary hook for +3 min increment. Planner adds half-time check here.
- `applyRoll` (`gameEngine.ts:438`) — each branch (PASS, SHOT, HEADER, LOOSE_BALL) needs `lastActionType` update and time increment. SHOT branch already returns to KICK_OFF on goal.
- `applyGKRestart` (`gameEngine.ts:828`) — GK kick = +1 min, throw/movement = +0. `lastActionType` set here too.
- `PITCH_REGIONS.centreCircle` and `isInRegion()` (`packages/shared/src/pitch.ts`) — zone validation for KICK_OFF_SETUP placement rules (D-11).
- `broadcastState` (`roomStore.ts:220`) — existing ARCH-04 entry point. Replay uses this to emit one frame per second (setInterval loop).
- `HOME_SQUAD` / `AWAY_SQUAD` piece positions in `teams.ts` — Phase 7.1 updated these to 4-5-2 on the real 37×26 board. Used as reset positions before KICK_OFF_SETUP.
- `useGameStore` (`packages/client/src/store/useGameStore.ts`) — `screen` field routes UI; Phase 8 adds `KICK_OFF_SETUP`, `HALF_TIME`, `FULL_TIME`, `REPLAY` screen values.
- `TurnIndicator` with existing score display (`packages/client/src/components/TurnIndicator.tsx:24`) — score already shown via `useGameStore(s => s.gameState.score)`.

### Established Patterns

- **Pure function engine, no rollDice inside** — `applyRoll` receives pre-generated dice. `applySnapshot` must follow the same pattern: caller generates dice, passes in.
- **Discriminated union results** (`ApplyMoveResult`, `ApplyEndTurnResult`, etc.) — all new engine functions follow this pattern.
- **Single SVG root, DOM-order z-ordering** — kick-off setup zone highlights follow existing HexCell fill pattern.
- **Zustand per-slice selectors** — new screens read only what they need from the store.
- **`socket.off(event, handler)` cleanup** — every new socket listener must return cleanup.
- **`isProcessing` mutex** — all new server handlers must check and set `room.isProcessing`.

### Integration Points

- `App.tsx` screen routing → add `KICK_OFF_SETUP`, `HALF_TIME`, `FULL_TIME`, `REPLAY` cases alongside existing `GAME_BOARD`
- `onGameState` handler in `App.tsx` → GameState.phase drives screen routing; REPLAY phase triggers `ReplayScreen`
- `packages/shared/src/types.ts` → `GamePhase` already includes `HALF_TIME`, `FULL_TIME`, `REPLAY` — no type changes needed for phase values; new `LastActionType` type and GameState fields to add
- `gameHandlers.ts` → all existing handlers need `lastActionType` validation check before processing; new `game:ready` handler for kick-off setup
- `roomStore.ts` Room type → add `replayTimer: ReturnType<typeof setInterval> | null`; must be cleared in `deleteRoom`

</code_context>

<specifics>

## Specific Ideas

- **Action eligibility table as a shared constant:** Define the table as a `Record<LastActionType, Set<NextActionType>>` constant in `packages/shared/src/actionSequence.ts`. This keeps it unit-testable and importable by both server (validation) and client (UI — disable buttons for invalid actions).
- **addedTime display:** Once addedTime is set (when actionCount crosses 45), the client should show "+N'" in the score/time display so both players know how much extra time remains.
- **Replay timer on the server:** Use `setInterval(callback, 1000)` in the `game:full-time` transition handler. The callback reconstructs each GameState by re-running game engine transitions from `buildInitialGameState` through the eventLog up to the current replay index. Store the interval handle in `room.replayTimer`.
- **KICK_OFF_SETUP zone tinting:** Colouring the pitch to show valid placement zones — green tint for the current team's valid hexes, red for occupied/invalid. Follows the existing HexCell fill colour approach.
- **"Play Again" resets to lobby:** Clicking "Play Again" from the replay/full-time screen emits a socket event or simply disconnects — no server-side rematch room reuse. Players get a fresh `CREATE_ROOM` / `JOIN_ROOM` flow. The simpler option is: client calls `setScreen('CREATE_ROOM')` without emitting anything; the room is cleaned up server-side on disconnect or timeout.
- **Second half kick-off automatic team assignment:** When "Start 2nd Half" is clicked, the server reads `state.kickOffTeam`, inverts it, sets the new `attackingTeam`, and transitions to `KICK_OFF_SETUP`. No separate client selection needed.

</specifics>

<deferred>

## Deferred Ideas

- **Replay pause/scrub controls** — auto-play only in Phase 8. Pause, step-forward, and step-back could be added in a follow-up polish phase.
- **Persistent room for rematch** — "Play Again" currently takes both players back to the lobby. In a future phase, a "Rematch" option could reuse the same room code with a fresh game state.
- **GK quick-throw target hex delivery** — Deferred from Phase 7 (07-CONTEXT.md). Phase 8's GK restart choice 'throw' still transitions to movement with ball held by GK; targetHex delivery remains deferred.

</deferred>

---

_Phase: 08-match-lifecycle-post-game-replay_
_Context gathered: 2026-06-04_
