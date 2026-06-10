# Phase 10: Remaining Action Flows + Tech Debt - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 completes broken game action flows — shot declaration, snapshot, and header-at-goal — and resolves accumulated technical debt from Phases 8 and 8.2. It also renames the PASS phase to ACTION throughout the codebase, fixes 9 named code review items, updates 3 failing integration tests, and corrects 5 player-reported gameplay bugs discovered in live play.

**In scope:**

- Shot declaration flow (SHOT-01 through SHOT-04): Shoot button currently permanently disabled; full shot sequence from declaration through GK dive through auto-resolution
- Snapshot (SNAP-02, SNAP-03): Snapshot button currently permanently disabled in MOVEMENT phase; SNAP-02 opponent deflection move (interactive) before snapshot shot
- Header at goal (HEAD-03): auto-detect via target hex; if attacker clicks a goal-line hex → GK save flow
- GamePhase rename: 'PASS' → 'ACTION' throughout codebase
- All 9 Phase 8 and 8.2 code review items (CR-01 BLOCKER through minor items)
- 3 failing integration tests (squad position mismatch)
- 5 player-reported gameplay bugs

**Out of scope:**

- PASS-02 mid-pass player movement (FIRST_TIME_PLAYER_MOVES) — deferred
- SHOT-02 GK visual 1-hex move before saving (outside penalty area) — modifier applied automatically via shotValidator, no visual GK relocation
- Any v2 features (fouls, corners, offsides, etc.)

</domain>

<decisions>
## Implementation Decisions

### Shot Declaration Flow

- **D-01:** Shot declaration is a two-step client flow: (1) shooter clicks "Shoot" → UI prompts them to click a highlighted goal hex; (2) clicking a goal hex emits a shot-declaration event to the server. There is no "Roll Dice" button — after GK dives, the server auto-resolves the entire shot.
- **D-02:** The shot declaration event transitions the game from ACTION phase to a new `SHOT_DECLARED` phase (or similar name). The existing `GAME_SHOT` handler currently requires `phase === 'SHOT'` and records UX metadata only — it must be reworked to accept from ACTION phase and trigger the state transition. The final SHOT phase and Roll Dice button become obsolete for regular shots (snapshot still enters SHOT directly and auto-resolves too).
- **D-03:** Server shot resolution order after GK dives: (1) auto-roll all defenders in the shot path (5 or 6, OR combined ≥10 with Tackling = deflect; within 1 hex of path: 6 OR combined ≥10 = deflect) → deflection → Loose Ball; (2) if no deflection: auto-roll shooter + GK dice → resolve duel; (3) broadcast full outcome with all individual roll logs.
- **D-04:** GK dive is interactive. After shot is declared, the game enters a `GK_DIVING` phase (or equivalent). The GK's team player clicks a hex to reposition the GK (up to 3 hexes parallel to goal line). At the 3rd hex: -1 Saving penalty (SHOT-04). If shot origin is 4+ hexes from GK's new position: unsaveable. GK can also stay put (no move). After the GK player confirms, the server auto-resolves.
- **D-05:** `shotTarget` (the goal hex) is recorded server-side in `GameState` for event log / display purposes; it is not consumed by dice resolution (duel uses attributes + dice only).

### Phase Rename: 'PASS' → 'ACTION'

- **D-06:** The GamePhase union value `'PASS'` is renamed to `'ACTION'` throughout the entire codebase — `types.ts`, `gameEngine.ts`, `gameHandlers.ts`, `ActionPanel.tsx`, and every other file that checks `phase === 'PASS'`. This is a full rename, not a UI-label-only change.
- **D-07:** All `phase === 'PASS'` guards, `DICE_PHASES` set entries, and client conditional renders become `=== 'ACTION'`. The test suite also updates to use `'ACTION'`.

### Snapshot (SNAP-02)

- **D-08:** SNAP-02 is fully implemented with an interactive opponent-deflection step. When a snapshot is declared, the game enters a new `SNAP_DEFLECT` phase. The opposing team moves exactly 1 player up to 2 hexes. After they confirm (or pass), the shot resolves using the same path-deflection + auto-roll flow as regular shots.
- **D-09:** The -1 shooter Snapshot penalty (`snapshotPenalty` flag) is already implemented server-side — retain it.
- **D-10:** The Snapshot button in the MOVEMENT phase is currently permanently `disabled` — wire it to `emitSnapshot` (the store function already exists at `useGameStore.ts:507`). The snapshot button in the ACTION phase (`passTrigger` guard) also needs to be correctly wired.

### Headers at Goal (HEAD-03)

- **D-11:** HEAD-03 is auto-detected. During HEADER phase, valid header target hexes are highlighted on the board (including goal-line hexes for the attacking team). The attacker clicks a target hex. If a goal-line hex is selected → GK save flow. If any other hex → attacker's winning contestant controls ball at that hex (headed pass).
- **D-12:** HEADER flow modification: add a target-hex selection step (attacker clicks a board hex after both teams confirm contestants). Add `headerTargetHex: HexCoord | null` to `GameState`. If duel resolves and target was a goal-line hex + attacker wins → enter GK dive / save path. `headerTargetHex` must be set server-side (authoritative re-validation before duel fires).
- **D-13:** HEAD-03 rule: "cannot be blocked by outfield defenders" — no defender path-deflection check on headed goal attempts. Only the GK contests.

### GK Save Flow (SHOT-05/SHOT-06)

- **D-14:** Full SHOT-05/06 save flow is in scope: GK makes save → handling check → clean catch → GK_RESTART (kick/throw/movement) OR spill → Loose Ball. This path exists in code but needs end-to-end live-session UAT to confirm it works correctly (UAT-01/02 below).

### Code Review Debt (all 9 items)

Phase 8 items (from `08-REVIEW.md`):

- **D-15 [CR-01 BLOCKER]:** `startReplayStream` stale-reference leak — re-fetch room inside the `setTimeout` callback via `getRoom(room.roomCode)`; if deleted during 3s hold, exit early. File: `packages/server/src/gameHandlers.ts` ~line 143–161.
- **D-16 [WR-01]:** Remove dead `'HIGH_PASS'` entry from the `passTypes` Set in `applySnapshot`. File: `packages/server/src/gameEngine.ts` ~line 1143–1152.
- **D-17 [WR-02]:** Intermediate slot transitions (ATTACKER_4→DEFENDER_5 etc.) in `applyEndTurn` must reset `lastActionType`, matching the behaviour of the final ATTACKER_2→null transition. File: `packages/server/src/gameEngine.ts` ~line 395–408.
- **D-18 [WR-03]:** `passTrigger` snapshot condition in `ActionPanel.tsx` — replace `lastActionType !== null` with `isEligible('SNAPSHOT')`. File: `packages/client/src/components/ActionPanel.tsx` ~line 60–61.
- **D-19 [WR-04]:** Duplicate HEADER resolution buttons (both "Roll Dice" and "Header" appear). Remove the dedicated "Header" button / `GAME_HEADER` event path, OR exclude HEADER from the Roll Dice button. Files: `packages/server/src/gameHandlers.ts` ~line 740–784 and `ActionPanel.tsx`.
- **D-20 [IN-01]:** Hoist the `passTypes` Set in `applySnapshot` to a module-level constant. File: `packages/server/src/gameEngine.ts` ~line 1143.

Phase 8.2 deferred items (from `08.2-VERIFICATION.md`):

- **D-21:** Fix `Math.floor(Math.random() * tied.length)` in `pickWinner` (HEADER duel branch in `gameEngine.ts`) — inject dice from the handler, keeping the engine pure.
- **D-22:** Fix GOAL outcome not appended to `eventLog` — goals must be logged so replays show correct scores.
- **D-23:** Fix HEADER LOOSE_BALL case that incorrectly sets `lastActionType: 'HEADER'` instead of `'DEFLECTION'`.
- **D-24:** Fix `GAME_RESTART_MOVEMENT` error paths that are missing a `broadcastState` snap-back call.

### Integration Test Fixes

- **D-25:** Update 3 failing tests in `game.integration.test.ts` to use real `HOME_SQUAD`/`AWAY_SQUAD` piece IDs and their actual positions on the 37×26 board (not Phase 2-era hardcoded coordinates). Tests: D-10 undo reversal, D-09 UNDO_LOCKED after SLOT_ADVANCE, and the PASS-phase roll test.

### Player-Reported Gameplay Bugs

- **D-26 [Loose Ball boundary]:** Loose Ball trajectory must clamp to valid pitch hexes. `r=0` is out of bounds on the real 37×26 board (top row starts at `r=1` for affected columns). Use `PITCH_HEXES` set membership to validate each trajectory step; stop at the boundary hex rather than walking off-board.
- **D-27 [Action log colour]:** Pass log entries must show the active team's colour indicator. Apply the same team-colour treatment as other events in `ActionLog.tsx`.
- **D-28 [High pass movement highlight]:** `HIGH_PASS_MOVEMENT` phase — valid movement hexes are not cleared after the movement ends. Fix the highlight persistence; ensure highlights are correctly computed for the current mover during repositioning, and cleared when the turn advances.
- **D-29 [One steal + tackle per player per phase]:** Each player piece may only attempt one steal and one tackle per movement phase. Track `stealAttemptedByIds: string[]` and `tackleAttemptedByIds: string[]` in `GameState`. Server rejects steal/tackle from a piece already in either list for the current phase. Both lists cleared in `applyStartMovement`.
- **D-30 [Loose ball pickup during movement]:** When a player picks up a loose ball during a movement action, movement must continue — the piece retains its remaining pace hexes. Do not end the movement action on pickup.

### Human UAT Required

- **UAT-01:** Snapshot full-path test — ball carrier in opponent penalty area during MOVEMENT; click Snapshot; SNAP_DEFLECT phase fires (opponent moves a player); shot resolves with -1 penalty; no GAME_ERROR. Requires live two-player session.
- **UAT-02:** Header button interaction path — after High Pass, HEADER phase; select contestant; click goal-line hex as target; GK dives; auto-resolves correctly. Both clients consistent. Requires live session.
- **UAT-03:** HEADER auto-roll acknowledgment — after both teams confirm contestants, duel fires immediately without a separate "Roll Header" button. Confirm this is the intended design.

### Claude's Discretion

- New phase names (`SHOT_DECLARED`, `GK_DIVING`, `SNAP_DEFLECT`) — naming and exact FSM sub-phase structure; implement what best fits the existing FSM pattern.
- Whether to reuse `GAME_SHOT` event or introduce a new `GAME_DECLARE_SHOT` event — follow existing event naming convention.
- Exact highlight colour for goal-line hexes in the HEADER target picker (reuse the existing shot-target highlight, or distinct colour).
- Order of D-15 through D-24 code review fixes within the plan — planner may group them logically.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game Engine — Shot & Resolution

- `packages/server/src/gameEngine.ts` — `applyRoll` (SHOT, HEADER, LOOSE_BALL branches), `applySnapshot`, `applyStartMovement`, `applyEndTurn`; all new shot-phase transitions go here
- `packages/shared/src/shotValidator.ts` — `validateShotDuel`, `validateGKDive`, `getOutsideAreaModifiers`, `validateHandlingCheck`
- `packages/shared/src/actionSequence.ts` — `ELIGIBLE_NEXT_ACTIONS` sequence table; `SHOT` and `SNAPSHOT` eligibility entries

### Game Engine — Passing & Headers

- `packages/server/src/gameEngine.ts` HEADER branch (~line 1110–1234) — contestant resolution; `headerContestants`, `headerConfirmed`; add `headerTargetHex` logic here
- `packages/shared/src/types.ts` — `GamePhase` union (add `SHOT_DECLARED`, `GK_DIVING`, `SNAP_DEFLECT`; rename `'PASS'` → `'ACTION'`); `GameState` fields to add: `headerTargetHex`, `shotTargetHex`, `stealAttemptedByIds`, `tackleAttemptedByIds`, `gkDivePosition`

### Handlers

- `packages/server/src/gameHandlers.ts` — `GAME_SHOT` (rework), `GAME_SNAPSHOT`, `GAME_HEADER`, `GAME_ROLL`; `startReplayStream` (D-15 fix); `GAME_RESTART_MOVEMENT` (D-24 fix)
- `packages/shared/src/events.ts` — `ClientEvents` and `ServerEvents`; add new event constants if needed

### Client

- `packages/client/src/components/ActionPanel.tsx` — Shot/Snapshot buttons (currently disabled, wire them); HEADER phase UI (add target-hex step); ACTION phase rename
- `packages/client/src/store/useGameStore.ts` — `emitSnapshot` (line 507, exists); add `emitDeclareShot`; `emitGKDive`
- `packages/client/src/components/ActionLog.tsx` — team colour on pass entries (D-27)

### Code Review Debt Source Docs

- `.planning/phases/08-match-lifecycle-post-game-replay/08-REVIEW.md` — CR-01 (BLOCKER), WR-01 through WR-04, IN-01 with exact file/line references
- `.planning/phases/08.2-passing-cleanup-inserted/08.2-VERIFICATION.md` — Phase 8.2 deferred items (D-21 through D-24)
- `.planning/phases/08.2-passing-cleanup-inserted/deferred-items.md` — integration test failure details (D-25)

### Tests

- `packages/server/src/__tests__/game.integration.test.ts` — 3 failing tests to update (D-25)
- `packages/server/src/__tests__/gameEngine.test.ts` — existing SHOT and PASS tests; extend for new shot-declaration path
- `packages/server/src/__tests__/gameHandlers.test.ts` — handler tests; extend for GK dive, SNAP_DEFLECT, shot declaration

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `ActionPanel.tsx` three-step PASS/ACTION flow (select type → click target → roll) — same two-step pattern applies for shot declaration (Shoot → click goal hex)
- `emitSnapshot: () => void` in `useGameStore.ts` (line 507) — already implemented, just needs wiring in `ActionPanel` MOVEMENT phase
- `applyRoll` SHOT branch (~line 1013–1124 of `gameEngine.ts`) — fully implemented including SHOT-01/02/03/04/06; the declaration step is the only missing piece
- `validateGKDive` in `shotValidator.ts` — distance-based penalty; needs caller to pass GK's new (post-dive) position rather than starting position
- `validateShotDuel` in `shotValidator.ts` — complete, injectable dice, SHOT-03 auto-miss guard, DICE-04 penalty cap
- `GAME_HEADER_CONTESTANT` handler pattern — contestant selection with both-teams-confirmed guard; similar pattern needed for GK dive confirmation
- `HIGH_PASS_MOVEMENT` phase already exists (both-teams-reposition pattern) — same pattern applies for `SNAP_DEFLECT` and `GK_DIVING`

### Established Patterns

- `isProcessing` mutex on all game handlers — mandatory for any new handler
- `broadcastState` after every validated action (error paths must also snap-back)
- `isActivePlayer` + phase guard on all handlers before processing
- `ELIGIBLE_NEXT_ACTIONS` sequence table controls what's available; new phases must be included or excluded correctly
- Server pre-generates dice (e.g., interception dice) before calling pure engine functions — same pattern for defender deflection dice

### Integration Points

- New GamePhase values (`SHOT_DECLARED`, `GK_DIVING`, `SNAP_DEFLECT`) → `GamePhase` union in `types.ts` + all switch/conditional guards that enumerate phases
- `headerTargetHex` field → `GameState` in `types.ts`; set by new handler, read in `applyRoll` HEADER branch
- `stealAttemptedByIds` / `tackleAttemptedByIds` → `GameState`; cleared in `applyStartMovement`; checked in ZoI/tackle handlers
- Phase rename `'PASS'` → `'ACTION'` touches ~20+ files; automated sed/replace then type-check pass

</code_context>

<specifics>
## Specific Ideas

- **Shot resolution is fully auto after GK dives** — no Roll Dice button for the shooter; server rolls everything and broadcasts. This deviates from the current SHOT phase Roll Dice pattern.
- **Defender deflection in shot path uses exact rules**: in-path = 5/6 or combined ≥10 with Tackling; within-1-hex-of-path = 6 or combined ≥10 with Tackling. Deflection triggers Loose Ball at the deflector's position.
- **HEAD-03 via goal-line hex selection** — no separate "Header at Goal" button; the target hex picker does double duty. Goal-line hexes highlighted as a distinct visual when within header range.
- **All intermediate rolls are logged** — every deflection roll, dive penalty, GK dice, shooter dice get event log entries for replay correctness.
- **Phase rename must be grep-verified after completion**: `grep -r "=== 'PASS'\|=== \"PASS\"\|: 'PASS'\|: \"PASS\"" packages/` should return zero results (except in test strings that describe old behaviour).

</specifics>

<deferred>
## Deferred Ideas

- **PASS-02 mid-pass player movement** (`FIRST_TIME_PLAYER_MOVES` effect) — explicitly deferred from Phase 8.2 with a TODO comment in `gameEngine.ts` line 960; not in Phase 10 scope.
- **SHOT-02 GK visual relocation** (outside penalty area: GK moves 1 hex before saving) — the `-1` shooter penalty modifier is applied via `getOutsideAreaModifiers()` in `shotValidator.ts`, but the GK piece does not visually relocate. GK visual move deferred to v2.
- **Rematch flow**, **chat**, **spectator mode** — v2 scope per REQUIREMENTS.md.

</deferred>

---

_Phase: 10-remaining-action-flows-tech-debt_
_Context gathered: 2026-06-09_
