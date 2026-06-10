# Phase 10: Remaining Action Flows + Tech Debt - Research

**Researched:** 2026-06-09
**Domain:** Game FSM extension, shot/snapshot/header flows, TypeScript rename, integration test repair
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Shot Declaration Flow**

- D-01: Two-step client flow: shooter clicks "Shoot" → UI prompts click on highlighted goal hex; clicking goal hex emits shot-declaration event. No Roll Dice button — server auto-resolves entire shot after GK dives.
- D-02: Shot declaration event transitions ACTION → `SHOT_DECLARED`. Existing `GAME_SHOT` handler (currently accepts from `SHOT` phase only) must be reworked to accept from ACTION phase and trigger state transition. Final SHOT phase Roll Dice button becomes obsolete for regular shots.
- D-03: Shot resolution order after GK dives: (1) auto-roll defenders in shot path (5/6 or combined ≥10 with Tackling = deflect; within 1 hex of path: 6 or combined ≥10 = deflect) → deflection → Loose Ball; (2) if no deflection: auto-roll shooter + GK → resolve duel; (3) broadcast full outcome with all individual roll logs.
- D-04: GK dive is interactive. After shot declared → `GK_DIVING` phase. GK's team player clicks hex to reposition GK (up to 3 hexes parallel to goal line). At 3rd hex: -1 Saving penalty (SHOT-04). If shot origin is 4+ hexes from GK's new position: unsaveable. GK can also stay put. After GK player confirms → server auto-resolves.
- D-05: `shotTarget` recorded server-side in `GameState` for event log/display; NOT consumed by dice resolution.

**Phase Rename: 'PASS' → 'ACTION'**

- D-06: Full rename throughout entire codebase — `types.ts`, `gameEngine.ts`, `gameHandlers.ts`, `ActionPanel.tsx`, and every other file. Not UI-label-only.
- D-07: All `phase === 'PASS'` guards, `DICE_PHASES` set entries, client conditional renders become `=== 'ACTION'`. Test suite also updates to use `'ACTION'`.

**Snapshot (SNAP-02)**

- D-08: SNAP-02 fully implemented with interactive opponent-deflection step. Shot declaration → `SNAP_DEFLECT` phase → opposing team moves exactly 1 player up to 2 hexes → confirm/pass → shot resolves using path-deflection + auto-roll same as regular shots.
- D-09: The -1 shooter Snapshot penalty (`snapshotPenalty` flag) is already implemented server-side — retain it.
- D-10: Snapshot button in MOVEMENT phase is currently permanently `disabled` — wire it to `emitSnapshot` (the store function already exists at `useGameStore.ts:507`). Snapshot button in ACTION phase (`passTrigger` guard) also needs correct wiring.

**Headers at Goal (HEAD-03)**

- D-11: HEAD-03 is auto-detected. During HEADER phase, attacker clicks a target hex. If goal-line hex selected → GK save flow. If any other hex → attacker's winning contestant controls ball at that hex (headed pass).
- D-12: HEADER flow modification: add target-hex selection step after both teams confirm contestants. Add `headerTargetHex: HexCoord | null` to `GameState`. If duel resolves and target was goal-line hex + attacker wins → enter GK dive/save path. `headerTargetHex` must be set server-side.
- D-13: HEAD-03 rule: "cannot be blocked by outfield defenders" — no defender path-deflection check on headed goal attempts. Only GK contests.

**GK Save Flow**

- D-14: Full SHOT-05/06 save flow in scope: GK makes save → handling check → clean catch → GK_RESTART (kick/throw/movement) OR spill → Loose Ball. Needs end-to-end UAT.

**Code Review Debt (all 9 items)**

- D-15 [CR-01 BLOCKER]: `startReplayStream` stale-reference leak — re-fetch room inside `setTimeout` callback via `getRoom(room.roomCode)`; if deleted during 3s hold, exit early. File: `packages/server/src/gameHandlers.ts` ~line 143–161.
- D-16 [WR-01]: Remove dead `'HIGH_PASS'` entry from `passTypes` Set in `applySnapshot`. File: `packages/server/src/gameEngine.ts` ~line 1143–1152.
- D-17 [WR-02]: Intermediate slot transitions (ATTACKER_4→DEFENDER_5 etc.) in `applyEndTurn` must reset `lastActionType`, matching ATTACKER_2→null transition. File: `packages/server/src/gameEngine.ts` ~line 395–408. (Confirmed: ~line 588–599 in the current file — the non-ATTACKER_2 return block at line 588 does NOT set `lastActionType`.)
- D-18 [WR-03]: `passTrigger` snapshot condition in `ActionPanel.tsx` — replace `lastActionType !== null` with `isEligible('SNAPSHOT')`. File: `packages/client/src/components/ActionPanel.tsx` ~line 60–61.
- D-19 [WR-04]: Duplicate HEADER resolution buttons. Remove dedicated "Header" button/`GAME_HEADER` event path OR exclude HEADER from Roll Dice button. Files: `packages/server/src/gameHandlers.ts` ~line 740–784 and `ActionPanel.tsx`.
- D-20 [IN-01]: Hoist `passTypes` Set in `applySnapshot` to module-level constant. File: `packages/server/src/gameEngine.ts` ~line 1143.
- D-21: Fix `Math.floor(Math.random() * tied.length)` in `pickWinner` (HEADER duel branch) — inject dice from handler, keeping engine pure.
- D-22: Fix GOAL outcome not appended to `eventLog` — goals must be logged so replays show correct scores.
- D-23: Fix HEADER LOOSE_BALL case sets `lastActionType: 'HEADER'` instead of `'DEFLECTION'`.
- D-24: Fix `GAME_RESTART_MOVEMENT` error paths missing `broadcastState` snap-back call.

**Integration Test Fixes**

- D-25: Update 3 failing tests in `game.integration.test.ts` to use real `HOME_SQUAD`/`AWAY_SQUAD` piece IDs and actual positions on the 37×26 board.

**Player-Reported Gameplay Bugs**

- D-26 [Loose Ball boundary]: Clamp trajectory to `PITCH_HEXES` membership; stop at boundary hex rather than walking off-board.
- D-27 [Action log colour]: Pass log entries must show active team's colour indicator.
- D-28 [High pass movement highlight]: `HIGH_PASS_MOVEMENT` phase — valid movement hexes not cleared after movement ends. Fix highlight persistence.
- D-29 [One steal + tackle per player per phase]: Track `stealAttemptedByIds: string[]` and `tackleAttemptedByIds: string[]` in `GameState`. Server rejects steal/tackle from piece already in either list. Both lists cleared in `applyStartMovement`.
- D-30 [Loose ball pickup during movement]: When player picks up loose ball during movement, movement continues — piece retains remaining pace hexes. Do not end movement on pickup.

**Human UAT Required**

- UAT-01: Snapshot full-path test — live two-player session.
- UAT-02: Header button interaction path — live session.
- UAT-03: HEADER auto-roll acknowledgment.

### Claude's Discretion

- New phase names (`SHOT_DECLARED`, `GK_DIVING`, `SNAP_DEFLECT`) — naming and exact FSM sub-phase structure.
- Whether to reuse `GAME_SHOT` event or introduce a new `GAME_DECLARE_SHOT` event — follow existing event naming convention.
- Exact highlight colour for goal-line hexes in HEADER target picker.
- Order of D-15 through D-24 code review fixes within the plan — planner may group them logically.

### Deferred Ideas (OUT OF SCOPE)

- PASS-02 mid-pass player movement (FIRST_TIME_PLAYER_MOVES) — explicitly deferred.
- SHOT-02 GK visual relocation (outside penalty area) — modifier applied via `getOutsideAreaModifiers()`, no visual GK move.
- Rematch flow, chat, spectator mode — v2 scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                             | Research Support                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| SHOT-01 | Shot declared in a direction; shooter rolls Shooting + dice vs goalkeeper's Saving + dice; attacker score higher = goal | `validateShotDuel` in `shotValidator.ts` is complete; only the declaration step and new FSM phases are missing |
| SHOT-02 | Shots from outside the penalty area receive -1 dice penalty; GK moves 1 hex before saving                               | `getOutsideAreaModifiers()` exists; visual GK relocation deferred; penalty modifier only                       |
| SHOT-03 | Rolling a 1 on a shot is an automatic miss                                                                              | Already implemented in `validateShotDuel` — no changes needed                                                  |
| SHOT-04 | GK may dive up to 3 hexes; 3rd hex = -1 Saving; 4+ hexes = unsaveable                                                   | `validateGKDive` in `shotValidator.ts` is complete; GK_DIVING phase just needs interactive move UI             |
| SNAP-02 | Snapshot: -1 penalty; 1 opponent moves a player up to 2 hexes before shot                                               | `snapshotPenalty` exists; SNAP_DEFLECT phase is the only missing piece                                         |
| SNAP-03 | All standard shooting rules apply to snapshots                                                                          | Already implemented in `applyRoll` SHOT branch when `snapshotPenalty=true`                                     |
| HEAD-01 | Header rules: within 1 hex = normal; within 2 hexes = -1 dice penalty                                                   | `validateHeading` handles this; no changes needed                                                              |
| HEAD-02 | Uncontested header won automatically (no dice roll)                                                                     | Implemented in HEADER applyRoll branch — no changes needed                                                     |
| HEAD-03 | Headed attempt at goal: declared before rolling; if attacker wins, GK saves; no outfield deflection                     | `headerTargetHex` selection step + redirect to GK save flow on goal-line hex                                   |
| HEAD-04 | Headed pass cannot be intercepted; two consecutive headed passes not allowed                                            | Already enforced by ELIGIBLE_NEXT_ACTIONS — no changes needed                                                  |
| HEAD-05 | Players who challenged for a header cannot participate in subsequent Movement Phase                                     | Already implemented via `contestedPieceIds` — no changes needed                                                |

</phase_requirements>

---

## Summary

Phase 10 is a pure codebase-completion phase — no new third-party libraries, no infrastructure changes, and no architectural pivots. All required game logic validators already exist in `packages/shared/src/shotValidator.ts` (`validateShotDuel`, `validateGKDive`, `validateHandlingCheck`) and the `applyRoll` SHOT branch in `gameEngine.ts` is fully implemented. The missing pieces are:

1. **FSM plumbing**: Three new `GamePhase` values (`SHOT_DECLARED`, `GK_DIVING`, `SNAP_DEFLECT`) need to be added to `types.ts`, handlers wired, and the `GAME_SHOT` handler reworked from a UX-metadata recorder into a state-transitioning declaration event.

2. **Shot declaration two-step**: The client currently shows a permanently disabled "Shoot" button. It needs to become a two-step interaction (Shoot → click goal hex) that emits to the server and enters `SHOT_DECLARED`, then `GK_DIVING` for the GK's team to interactively reposition, then server auto-resolves.

3. **HEAD-03 target-hex selection**: The HEADER phase needs a post-confirmation target-hex click step before dice roll. If the selected hex is a goal-line hex, the attacker-win path redirects to GK dive/save rather than a headed pass.

4. **SNAP_DEFLECT interactive step**: After snapshot declaration, the defending team gets to move 1 player up to 2 hexes before the shot resolves. This mirrors the existing `HIGH_PASS_MOVEMENT` pattern exactly.

5. **'PASS' → 'ACTION' rename**: Touches ~20+ files. The rename is mechanical but must be exhaustive — every `phase === 'PASS'` guard, `DICE_PHASES` Set, and test string.

6. **9 code review items + 5 gameplay bugs + 3 integration test failures**: All are surgical fixes in known locations; no design ambiguity.

**Primary recommendation:** Implement the phase rename first (D-06/D-07) so all subsequent work uses the correct phase name, then implement code review debt fixes, then new FSM phases and shot/snapshot/header flows, then gameplay bugs, then integration tests last.

---

## Architectural Responsibility Map

| Capability                        | Primary Tier                                    | Secondary Tier                     | Rationale                                                                  |
| --------------------------------- | ----------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| Shot declaration state machine    | API / Backend (gameEngine.ts)                   | Client (ActionPanel.tsx UI)        | Server is authoritative; client only emits intent                          |
| GK dive interactive repositioning | API / Backend (gameHandlers.ts)                 | Client (ActionPanel.tsx / HexGrid) | Same pattern as HIGH_PASS_MOVEMENT — server validates hex, client shows UI |
| Snapshot deflect interactive step | API / Backend (gameEngine.ts)                   | Client (ActionPanel.tsx)           | Mirrors HIGH_PASS_MOVEMENT pattern exactly                                 |
| Header target-hex selection       | API / Backend (gameHandlers.ts)                 | Client (HexGrid click → handler)   | Must be server-authoritative (HEAD-03 goal-line detection)                 |
| 'PASS' → 'ACTION' rename          | Shared types → propagated everywhere            | —                                  | types.ts is source of truth; TypeScript compiler enforces completeness     |
| Defender path deflection (shot)   | API / Backend (gameEngine.ts)                   | Shared (hexLine for path geometry) | Pure engine function; uses existing `hexLine`                              |
| Integration test repair           | Test layer                                      | —                                  | Standalone — no production code changes                                    |
| Gameplay bug fixes                | API / Backend (gameEngine.ts + gameHandlers.ts) | Client (ActionLog.tsx for D-27)    | Most bugs are server-side state logic; one is client display               |

---

## Standard Stack

No new packages required for this phase. All implementation uses the existing stack.

### Existing Tools Used in This Phase

| Tool            | Version    | Purpose                                                       | Location                             |
| --------------- | ---------- | ------------------------------------------------------------- | ------------------------------------ |
| honeycomb-grid  | 4.x        | Hex geometry for path deflection (hexLine, hexDistance)       | `packages/shared`                    |
| socket.io       | 4.x        | New event handlers for SHOT_DECLARED, GK_DIVING, SNAP_DEFLECT | `packages/server`                    |
| TypeScript      | 5.x        | Full type-check after rename as correctness gate              | all packages                         |
| Vitest          | current    | Existing test suites — unit, handler, integration             | `packages/server`, `packages/shared` |
| React + Zustand | 18.x / 4.x | ActionPanel new phases, new store actions                     | `packages/client`                    |

**Installation:** None required.

---

## Package Legitimacy Audit

No new external packages are introduced in this phase.

| Package | Verdict | Disposition |
| ------- | ------- | ----------- |
| (none)  | —       | N/A         |

---

## Architecture Patterns

### System Architecture Diagram

```
CLIENT                          SERVER (gameHandlers.ts)        ENGINE (gameEngine.ts)
------                          ------------------------        ----------------------
Shoot button click              GAME_SHOT (reworked)
→ emit GAME_SHOT(goalHex)  →    phase=ACTION guard              applyDeclarShot (new)
                                validate goalHex shape          → phase: SHOT_DECLARED
                                broadcastState              ←

GK player clicks hex            GAME_GK_DIVE (new)             applyGKDive (new inline)
→ emit GAME_GK_DIVE(hex)   →    phase=GK_DIVING guard          → validate parallel-to-goal
                                broadcastState              ←

GK confirms                     GAME_END_TURN (existing)        auto-resolution:
→ emit GAME_END_TURN       →    phase=GK_DIVING guard          1. roll each path defender
                                pre-generate all dice          2. if no deflection:
                                                               validateShotDuel(shooter,gk)
                                                               3. handleResult (GOAL/MISS/SAVE)
                                broadcastState              ←

[SNAP_DEFLECT]
After GAME_SNAPSHOT             Enter SNAP_DEFLECT phase
opponent player clicks hex →    GAME_MOVE (existing handler)   moves 1 player ≤2 hexes
opponent clicks End Turn   →    GAME_END_TURN                  auto-resolves shot
                                                               same as regular shot path

[HEAD-03 target-hex selection]
After both headerConfirmed       GAME_HEADER_TARGET (new event)
attacker clicks target hex →     validate target hex
                                 set headerTargetHex in state
                                 if goal-line hex: after duel
                                   attacker win → GK_DIVING
                                   else → headed pass to PASS phase
```

### Recommended File Structure Changes

```
packages/shared/src/
  types.ts                 — add SHOT_DECLARED, GK_DIVING, SNAP_DEFLECT to GamePhase
                             rename 'PASS' → 'ACTION'
                             add headerTargetHex, shotTargetHex, gkDivePosition,
                             stealAttemptedByIds, tackleAttemptedByIds fields to GameState
  events.ts               — add GAME_DECLARE_SHOT, GAME_GK_DIVE, GAME_HEADER_TARGET events
                             (or reuse GAME_SHOT for declaration — see Pattern 2)
  actionSequence.ts       — update DICE_PHASES concept (remove 'PASS', add 'ACTION')

packages/server/src/
  gameHandlers.ts         — rework GAME_SHOT handler; add GK_DIVING handler;
                             add SNAP_DEFLECT phase guard to GAME_MOVE;
                             add GAME_HEADER_TARGET handler; fix D-15/D-24
  gameEngine.ts           — add applyDeclareShot, applyGKDive functions;
                             extend applyRoll HEADER branch for headerTargetHex;
                             fix D-16/D-17/D-21/D-22/D-23; rename 'PASS'→'ACTION'

packages/client/src/
  components/ActionPanel.tsx  — wire Shoot button two-step flow; add GK_DIVING UI;
                                 add SNAP_DEFLECT UI; add HEADER target-hex step;
                                 rename PASS → ACTION; fix D-18/D-19
  store/useGameStore.ts       — add emitDeclareShot, emitGKDive, emitHeaderTarget;
                                 rename PASS references → ACTION
  components/ActionLog.tsx    — fix D-27 team colour on pass entries
  components/HexGrid.tsx      — fix D-28 highlight persistence; add goal-line hex highlights
```

### Pattern 1: New Interactive Phase (GK_DIVING / SNAP_DEFLECT)

**What:** A two-team interactive sub-phase where one team acts (moves a piece) and then confirms. Pattern already established by `HIGH_PASS_MOVEMENT`. [ASSUMED based on codebase reading]

**When to use:** Any phase where both teams need to see the board and one team interactively repositions before auto-resolution.

**Example (HIGH_PASS_MOVEMENT as template):**

```typescript
// Source: packages/server/src/gameHandlers.ts GAME_MOVE handler (existing)
if (room.gameState.phase === 'HIGH_PASS_MOVEMENT') {
  // 1. Validate active team
  if (!isActivePlayer(socket, room)) { ... }
  // 2. Lock to first piece moved (highPassMovedPieceId)
  // 3. Enforce pace cap (highPassPaceUsed >= 3)
  // 4. Enforce adjacency (hexDistance === 1)
  // 5. Enforce pitch boundary (PITCH_HEXES)
  // 6. Update state + broadcastState
}
// GAME_END_TURN handler switches slot from ATTACKER → DEFENDER → auto-resolves
```

For `GK_DIVING`: same structure, but:

- Active team = GK's team (not attackingTeam)
- Allowed pieces = only the GK piece
- Direction constraint = parallel to goal line (q stays constant for vertical goal line at q=0 or q=36)
- Max hexes = 3 (use `gkDivePosition` or distance tracker in state)
- Confirm = End Turn → auto-resolve shot

For `SNAP_DEFLECT`: same structure, but:

- Active team = defending team (opponent of attacker)
- Allowed pieces = any one opponent piece
- Max hexes = 2
- Confirm = End Turn → shot resolves with `snapshotPenalty=true`

### Pattern 2: GAME_SHOT Rework (D-02)

**Current:** `GAME_SHOT` handler accepts `phase === 'SHOT'` only; records `room.shotTarget` for UX, emits no state change, never broadcasts.

**New:** `GAME_SHOT` handler (or new `GAME_DECLARE_SHOT`) accepts `phase === 'ACTION'` when `lastActionType` is eligible for 'SHOT', validates the goal hex, and transitions to `SHOT_DECLARED` (then to `GK_DIVING`).

**Following existing event naming convention** (reusing `GAME_SHOT`): The handler's phase guard changes from `phase !== 'SHOT'` to `phase !== 'ACTION'`. The handler calls a new engine function `applyDeclareShot(state, goalHex)` that:

1. Validates goalHex is a goal-line hex for the attacking team
2. Validates sequence (ELIGIBLE_NEXT_ACTIONS check for 'SHOT')
3. Transitions to `SHOT_DECLARED`, then immediately to `GK_DIVING` (two state steps or combined)
4. Broadcasts state

### Pattern 3: Phase Rename (D-06/D-07)

**Scope:** Every occurrence of `'PASS'` as a `GamePhase` string literal in the codebase. This is distinct from `'PASS'` as part of pass-type strings like `'STANDARD_PASS'`.

**Grep pattern to verify completeness after rename:**

```bash
grep -r "=== 'PASS'\|=== \"PASS\"\|: 'PASS'\|: \"PASS\"\|phase.*PASS\|PASS.*phase" packages/
# Should return zero results except in comments and test descriptions
```

**Files confirmed to have `'PASS'` GamePhase references** [ASSUMED: codebase search]:

- `packages/shared/src/types.ts` — `GamePhase` union definition
- `packages/server/src/gameEngine.ts` — ~8 occurrences (LOOSE_BALL return, HEADER returns, GK restart, applySnapshot, GAME_START_MOVEMENT guard)
- `packages/server/src/gameHandlers.ts` — GAME_START_MOVEMENT guard, GAME_ROLL stateForRoll normalization, HIGH_PASS_MOVEMENT slot transition
- `packages/client/src/components/ActionPanel.tsx` — `phase === 'PASS'` condition block
- `packages/server/src/__tests__/gameEngine.test.ts`, `gameEngine.phase8.test.ts`, `gameHandlers.test.ts`, `game.integration.test.ts` — all test assertions

**TypeScript will catch any missed references** — after the rename, a `tsc --noEmit` across all packages is the authoritative completeness check.

### Pattern 4: Defender Path Deflection (D-03)

**What:** Before the shooter-vs-GK duel, each defender in or near the shot path auto-rolls for deflection.

**Shot path computation:** `hexLine(ball.position, shotTargetHex)` gives the path. The path defenders are:

- In-path: combined score with Tackling ≥10 OR die = 5 or 6 → deflect
- Within 1 hex of path: combined score with Tackling ≥10 OR die = 6 → deflect (harder condition)

**Implementation location:** New engine logic inside the shot resolution sequence, after GK dive confirmation. Pre-generate all deflection dice server-side before calling engine (same as interception dice pattern in `GAME_ROLL` handler).

**On deflect:** Transition to `LOOSE_BALL` phase with ball at the deflecting piece's position. No shooter-vs-GK duel occurs.

### Anti-Patterns to Avoid

- **Generating dice inside the pure engine:** All random values must be pre-generated in the handler layer (I/O layer) and injected into pure engine functions. See `applyRoll` signature — engine receives `d1, d2, d3`. Defender deflection dice must follow the same pattern (pre-generate in handler, pass to engine). [ASSUMED]
- **Missing broadcastState on error paths:** `GAME_RESTART_MOVEMENT` currently lacks snap-back on error. Every new handler must call `broadcastState(io, room)` on all error returns (D-24 fix pattern applies to all new handlers too). [ASSUMED: codebase reading]
- **Stale closure in setTimeout:** D-15 fix pattern — always re-fetch from store inside async callbacks rather than closing over mutable room object. [ASSUMED: codebase reading]
- **Checking `socket.rooms` for team identity:** Use `socket.data.playerSlot` → `socketTeam()` helper. Never `socket.rooms.has(roomCode)` for authorization. [ASSUMED: codebase pattern]
- **Forgetting to add new phases to all switch/conditional guards:** After adding `SHOT_DECLARED`, `GK_DIVING`, `SNAP_DEFLECT` to `GamePhase`, search all switch statements and if-chains that enumerate phases. TypeScript exhaustive checks (`default: never`) will catch them if guards are exhaustive. [ASSUMED]
- **Performing 'PASS' → 'ACTION' rename in tests before source:** Types.ts must be renamed first so TypeScript compile errors guide the full rename scope. [ASSUMED]

---

## Don't Hand-Roll

| Problem                   | Don't Build                        | Use Instead                                                         | Why                                           |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| Shot path geometry        | Custom hex line traversal          | `hexLine(from, to)` from `packages/shared`                          | Already implemented and tested                |
| Hex distance for GK dive  | Manual calculation                 | `hexDistance(a, b)` from `packages/shared`                          | Already implemented                           |
| Pitch boundary validation | Manual coord range check           | `PITCH_HEXES` Set membership (`isPitchHex(hex)`)                    | The 37×26 board definition is already encoded |
| Dice-cap enforcement      | Manual min/max                     | `computeCombinedScore(attr, die, penalties)` from `packages/shared` | DICE-04 -2 cap is applied centrally here      |
| Shot duel resolution      | Custom shooter-vs-GK logic         | `validateShotDuel()` from `shotValidator.ts`                        | SHOT-01/02/03/04 all handled; injectable dice |
| GK dive distance penalty  | Manual distance check              | `validateGKDive(gk, distance)`                                      | SHOT-04 distance → penalty mapping is there   |
| Handling check            | Manual die vs attribute comparison | `validateHandlingCheck(gk, die)`                                    | SHOT-06 implemented                           |
| Pitch region detection    | Manual coord bounds check          | `isInRegion(hex, regionName)` + `PITCH_REGIONS`                     | Penalty area, goal-line detection all encoded |

**Key insight:** The shot resolution machinery is entirely complete in the shared validators. Phase 10 is about adding the interactive steps (GK dive, defender deflection rolls) that surround the existing `validateShotDuel` call — not rebuilding the duel itself.

---

## Common Pitfalls

### Pitfall 1: GK Dive Direction Validation

**What goes wrong:** Allowing GK to move to non-parallel-to-goal-line hexes during `GK_DIVING` phase.

**Why it happens:** The goal line is at `q=0` (away goal) and `q=36` (home goal) in the flat-top hex layout. "Parallel to goal line" means `r` changes and `q` stays constant. A naive hex-adjacency check permits diagonal moves that change `q`.

**How to avoid:** In `GK_DIVING` handler, after finding the GK's new position candidate hex, assert `newHex.q === gk.position.q`. Additionally assert the destination is within the goal mouth rows (`r` ∈ [10..16] for the 7-hex goal mouth). [ASSUMED: based on PITCH_REGIONS encoding pattern]

**Warning signs:** GK repositions to a non-goal-line hex; unsaveability check produces incorrect results.

### Pitfall 2: Unsaveability Check Uses Post-Dive GK Position

**What goes wrong:** Computing shot distance from the GK's starting position rather than the post-dive position, causing unsaveable shots to be resolved as saveable.

**Why it happens:** `validateGKDive(gk, distance)` currently takes `distance` as a pre-computed argument. If the caller passes `hexDistance(gk.original_position, shooter.position)` rather than `hexDistance(gk.new_position, shooter.position)`, the penalty and savability check is wrong.

**How to avoid:** After GK dive is confirmed, compute `distance = hexDistance(gk.new_position, shooter.position)` and pass to `validateGKDive`. The `_gk` parameter is unused in the current implementation — distance is the only input. [ASSUMED: codebase reading of `validateGKDive`]

### Pitfall 3: 'PASS' vs Pass-Type Strings During Rename

**What goes wrong:** An automated sed/replace changes `'STANDARD_PASS'` or `'FIRST_TIME_PASS'` to `'STANDARD_ACTION'` because it hits substrings.

**Why it happens:** `'PASS'` appears both as a standalone `GamePhase` value and as a suffix in `LastActionType` values (`'STANDARD_PASS'`, etc.).

**How to avoid:** Use word-boundary grep patterns: `=== 'PASS'` and `: 'PASS'` and `'PASS'` as a standalone value. Do NOT replace substrings. After rename, run `tsc --noEmit` across all packages as the authoritative check.

### Pitfall 4: Missing Goal Event in eventLog (D-22)

**What goes wrong:** The GOAL branch in `applyRoll` SHOT case does not append a GOAL event to `eventLog`. Replay scores stay 0-0 because score increments in state but the log has no GOAL entry.

**Why it happens:** The `ActionEvent` union already has `{ type: 'GOAL'; scoringTeam: 'home' | 'away'; timestamp: number }`, but the return at gameEngine.ts ~line 1050 does not include it in `eventLog`.

**How to avoid:** In the GOAL branch, append `{ type: 'GOAL', scoringTeam: state.attackingTeam, timestamp: Date.now() }` to `eventLog`. [ASSUMED: codebase reading]

### Pitfall 5: Header Target Hex Must Be Validated Server-Side

**What goes wrong:** Client emits a goal-line hex that is not actually a valid goal-line hex for the attacking team (or is off-pitch), and the server accepts it, routing to a GK dive that makes no physical sense.

**Why it happens:** Trusting client-supplied coordinates without server-side re-validation.

**How to avoid:** In the `GAME_HEADER_TARGET` handler, re-validate the target hex: (a) it must be in `PITCH_HEXES`, (b) if it's a claimed goal-line hex, verify it matches the attacking team's goal side (`q === 36` for home attack, `q === 0` for away attack) and `r ∈ [10..16]`. [ASSUMED: based on PITCH_REGIONS encoding]

### Pitfall 6: HEADER LOOSE_BALL lastActionType Bug (D-23)

**What goes wrong:** The HEADER LOOSE_BALL branch sets `lastActionType: 'HEADER'` instead of `'DEFLECTION'`. When the LOOSE_BALL then resolves, it sets `lastActionType: 'DEFLECTION'` — so the bug is overwritten. However it is still incorrect during the `LOOSE_BALL` phase itself.

**How to avoid:** Fix the initial assignment to `lastActionType: 'DEFLECTION'` in the HEADER LOOSE_BALL case. Confirmed location: `gameEngine.ts` HEADER branch, the tie (equal scores) return block. [ASSUMED: codebase reading of line 1322–1350]

### Pitfall 7: pickWinner Randomness in Pure Engine (D-21)

**What goes wrong:** `pickWinner` in the HEADER duel branch calls `Math.floor(Math.random() * tied.length)` — non-deterministic in a supposedly pure engine function.

**Why it happens:** Tie-breaking within a team's contestant group requires a random selection, but the engine should not be calling random functions directly.

**How to avoid:** Pre-generate a tiebreak die in the handler (same as how `rollDice()` is pre-generated for all other random outcomes). Pass it through `applyRoll`'s `dice` array or as a separate injection parameter. One approach: add a 4th die `d4 = rollDice()` pre-generated in the handler, use it as the tiebreak index mod tied.length. [ASSUMED]

### Pitfall 8: Snapshot Button in MOVEMENT Needs Position Guard

**What goes wrong:** Snapshot button becomes enabled based only on distance to goal, but the server-side `applySnapshot` also checks that the ball carrier is in the opponent's penalty area (`isInRegion`). Client shows button as enabled when distance ≤ 6 hexes, but server rejects if carrier is not in penalty area.

**Current state in code:** `canSnapshot = distToGoal <= 6` in `ActionPanel.tsx` MOVEMENT block. This is a client-side approximation only. Enabling the button does not break anything (server will reject), but it is confusing UX if the button appears outside the penalty area.

**How to avoid:** Wire the button to `emitSnapshot` (D-10 fix) and optionally improve the client guard to also check penalty area membership via client-side state. [ASSUMED]

---

## Code Examples

### Example 1: CR-01 Fix — startReplayStream Stale Reference

**Current (buggy):**

```typescript
// Source: packages/server/src/gameHandlers.ts ~line 145-169
setTimeout(() => {
  let idx = 0;
  room.replayTimer = setInterval(() => { // room is stale if deleted during 3s hold
    ...
  }, 1000);
}, 3000);
```

**Fixed:**

```typescript
setTimeout(() => {
  const liveRoom = getRoom(room.roomCode); // re-fetch from store
  if (!liveRoom || liveRoom.gameState === null) return; // exit if deleted
  const liveFrames = buildReplayFrames(liveRoom.gameState);
  let idx = 0;
  liveRoom.replayTimer = setInterval(() => {
    if (idx >= liveFrames.length) {
      clearInterval(liveRoom.replayTimer!);
      liveRoom.replayTimer = null;
      return;
    }
    const frame = liveFrames[idx++]!;
    const replayFrame: GameState = { ...frame, replayIndex: idx, replayTotal: liveFrames.length };
    io.to(liveRoom.roomCode).emit(ServerEvents.GAME_STATE, replayFrame);
  }, 1000);
}, 3000);
```

[ASSUMED: derived from code review finding D-15 and codebase reading]

### Example 2: D-22 Fix — GOAL eventLog Entry

**Current (buggy):**

```typescript
// Source: packages/server/src/gameEngine.ts SHOT case, GOAL branch
return {
  ok: true,
  state: {
    ...state,
    phase: 'KICK_OFF_SETUP',
    score: newScore,
    ball: { position: state.ball.position, carrierId: null },
    lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
    lastActionType: null,
    snapshotPenalty: false,
    // NOTE: eventLog NOT updated — GOAL never recorded
  },
};
```

**Fixed:**

```typescript
return {
  ok: true,
  state: {
    ...state,
    phase: 'KICK_OFF_SETUP',
    score: newScore,
    ball: { position: state.ball.position, carrierId: null },
    lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
    lastActionType: null,
    snapshotPenalty: false,
    eventLog: [
      ...state.eventLog,
      { type: 'GOAL' as const, scoringTeam: state.attackingTeam, timestamp: Date.now() },
    ],
  },
};
```

[ASSUMED: derived from D-22 decision and ActionEvent union definition in types.ts]

### Example 3: D-17 Fix — Intermediate Slot lastActionType Reset

**Current (buggy):**

```typescript
// Source: packages/server/src/gameEngine.ts ~line 588-599
return {
  ok: true,
  state: {
    ...state, // spreads lastActionType from previous slot — WRONG
    phase: nextPhase,
    movementSlot: nextSlot,
    activeTeam: nextActiveTeam,
    eventLog: [...state.eventLog, slotAdvanceEvent],
    movedPieceIds: [...state.movedPieceIds, ...lockedOnEndSlot],
    paceUsedByPieceId: {},
    // lastActionType NOT reset
  },
};
```

**Fixed:** Add `lastActionType: 'MOVEMENT_PHASE'` to the spread (matching ATTACKER_2→null path).

### Example 4: New GameState Fields Required by Phase 10

```typescript
// Source: packages/shared/src/types.ts — additions for Phase 10
export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
  | 'KICK_OFF_SETUP'
  | 'MOVEMENT'
  | 'ACTION' // renamed from 'PASS'
  | 'SHOT_DECLARED' // new: shot declared, waiting for GK dive
  | 'GK_DIVING' // new: GK's team repositions GK interactively
  | 'SNAP_DEFLECT' // new: opponent moves 1 player before snapshot resolves
  | 'SHOT'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'LOOSE_BALL'
  | 'HIGH_PASS_MOVEMENT'
  | 'GK_RESTART'
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'REPLAY';

// New GameState fields:
export type GameState = {
  // ... existing fields ...
  /** Phase 10 HEAD-03: target hex selected by header attacker; null outside HEADER phase. */
  headerTargetHex?: HexCoord | null;
  /** Phase 10 SHOT_DECLARED: the goal hex the shooter declared. */
  shotTargetHex?: HexCoord | null;
  /** Phase 10 GK_DIVING: GK's current (post-dive) position during GK_DIVING phase. */
  gkDivePosition?: HexCoord | null;
  /** Phase 10 D-29: piece IDs that already attempted a steal this movement phase. */
  stealAttemptedByIds?: readonly string[];
  /** Phase 10 D-29: piece IDs that already attempted a tackle this movement phase. */
  tackleAttemptedByIds?: readonly string[];
};
```

[ASSUMED: derived from CONTEXT.md canonical refs section]

---

## State of the Art

| Old Approach                                              | Current Approach                                                    | When Changed | Impact                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------- | ------------ | ----------------------------------------------------------- |
| `GAME_SHOT` records UX metadata only, no state transition | Reworked `GAME_SHOT` transitions ACTION → SHOT_DECLARED → GK_DIVING | Phase 10     | Shot flow is now fully interactive end-to-end               |
| Snapshot enters SHOT directly (no deflection step)        | Snapshot enters SNAP_DEFLECT first (opponent moves 1 player)        | Phase 10     | SNAP-02 rule fully honoured                                 |
| `'PASS'` as GamePhase literal                             | `'ACTION'` throughout                                               | Phase 10     | Semantic clarity; PASS was ambiguous with pass-type actions |

**Deprecated/outdated after this phase:**

- `GAME_HEADER` Socket.io event (WR-04): remove the dedicated handler and event; HEADER is resolved via the auto-confirm pattern established in Phase 8.2.
- `GAME_SHOT` in its current metadata-only form: reworked to be a state-transitioning declaration event.
- The `passTypes` Set as a local const in `applySnapshot`: hoisted to module-level (IN-01).

---

## Runtime State Inventory

Step 2.6 SKIPPED for rename scope — the `'PASS'` → `'ACTION'` rename is a code/string literal change only. There is no persisted state (no database; game state is in-memory in `roomStore` and cleared between games). No OS registrations, no stored data, no build artifacts carrying the old string.

**Confirmed categories:**

- Stored data: None — game state is in-memory Node.js Map, cleared on server restart. No external DB.
- Live service config: None — no external services with this phase string.
- OS-registered state: None.
- Secrets/env vars: None reference `'PASS'`.
- Build artifacts: TypeScript compilation output in `dist/` — stale after rename but regenerated by `pnpm build`. No installed packages carry the string.

---

## Open Questions

1. **Goal-line hex definition for headed goals**
   - What we know: The pitch has goals at `q=0` (away goal) and `q=36` (home goal). The goal mouth spans `r ∈ [10..16]` based on PITCH_REGIONS from Phase 6 CONTEXT.md D-04/D-05.
   - What's unclear: Whether `r ∈ [10..16]` is the correct goal mouth range for headed goal detection, or whether only the innermost 6-yard-box hexes count.
   - Recommendation: Use the full goal mouth range `r ∈ [10..16]` at `q=0` or `q=36` for the HEAD-03 goal-line hex detection. Consistent with how the existing Shoot button distance computation uses the same coordinates (ActionPanel.tsx lines 225-228). [ASSUMED]

2. **GK dive direction constraint**
   - What we know: GK dives "parallel to the goal line" (rulebook description). Goal line is at `q=0` or `q=36`.
   - What's unclear: In flat-top hex geometry, which direction is "parallel"? Changing `r` at constant `q` moves along the goal line. Changing `q` moves away from it.
   - Recommendation: Constrain GK dive moves to adjacent hexes where `newHex.q === gk.position.q` (constant `q`, varying `r` only). [ASSUMED based on board geometry]

3. **Defender path deflection shot path definition**
   - What we know: D-03 states "in shot path = 5/6 or combined ≥10 with Tackling; within 1 hex of path = 6 or combined ≥10". `hexLine(from, to)` gives the path.
   - What's unclear: Does "in shot path" mean on the hexLine, or within 1 hex of the hexLine? The rulebook distinguishes two bands.
   - Recommendation: Implement two separate defender sets: Set A = hexes on `hexLine(shooterPos, shotTargetHex)` → easier deflection threshold; Set B = all hexes within 1 step of any hex in Set A but not in Set A → harder threshold. [ASSUMED]

---

## Environment Availability

Step 2.6: Phase is purely code/config changes. External environment dependencies are the same as the running dev server (Node.js 22 LTS, pnpm, TypeScript). No new external dependencies.

| Dependency     | Required By      | Available                | Version | Fallback |
| -------------- | ---------------- | ------------------------ | ------- | -------- |
| Node.js 22 LTS | Server runtime   | Confirmed (existing dev) | 22.x    | —        |
| pnpm 9.x       | Monorepo tooling | Confirmed (existing dev) | 9.x     | —        |
| TypeScript 5.x | Type checking    | Confirmed (existing dev) | 5.x     | —        |
| Vitest         | Test suite       | Confirmed (existing dev) | current | —        |

---

## Validation Architecture

### Test Framework

| Property                   | Value                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- |
| Framework                  | Vitest (server + shared)                                                     |
| Config file                | `packages/server/vitest.config.ts`, `packages/shared/vitest.config.ts`       |
| Quick run command (server) | `cd packages/server && npx vitest run --reporter=verbose`                    |
| Quick run command (shared) | `cd packages/shared && npx vitest run`                                       |
| Full suite command         | `pnpm -r test` or `pnpm --filter @counter-attack/server exec npx vitest run` |

### Phase Requirements → Test Map

| Req ID       | Behavior                                                 | Test Type          | Automated Command                                     | File Exists?                                        |
| ------------ | -------------------------------------------------------- | ------------------ | ----------------------------------------------------- | --------------------------------------------------- |
| SHOT-01      | Shot duel resolves correctly (GOAL/MISS/SAVE/LOOSE_BALL) | unit               | `npx vitest run --reporter=verbose -t "SHOT-01"`      | ✅ gameEngine.test.ts has SHOT tests                |
| SHOT-02      | Outside penalty area: -1 shooter penalty applied         | unit               | `npx vitest run -t "outside.*penalty\|SHOT-02"`       | ✅ existing                                         |
| SHOT-03      | Auto-miss on die=1                                       | unit               | `npx vitest run -t "SHOT-03\|auto.miss"`              | ✅ existing                                         |
| SHOT-04      | GK dive: 3rd hex = -1 saving; 4+ = unsaveable            | unit               | `npx vitest run -t "SHOT-04\|GK.*dive"`               | ✅ existing; needs GK_DIVING phase integration test |
| SNAP-02      | SNAP_DEFLECT phase: opponent deflects before shot        | unit + integration | `npx vitest run -t "SNAP-02\|SNAP_DEFLECT"`           | ❌ Wave 0 — new test needed                         |
| SNAP-03      | Snapshot uses standard shot rules                        | unit               | `npx vitest run -t "SNAP-03\|snapshot.*shot"`         | ✅ existing `snapshotPenalty` tests                 |
| HEAD-01      | Header distance penalty applied                          | unit               | `npx vitest run -t "HEAD-01\|header.*penalty"`        | ✅ existing                                         |
| HEAD-02      | Uncontested header: no dice                              | unit               | `npx vitest run -t "HEAD-02\|uncontested"`            | ✅ existing                                         |
| HEAD-03      | Header at goal: goal-line hex → GK save path             | integration        | `npx vitest run -t "HEAD-03\|header.*goal"`           | ❌ Wave 0 — new test needed                         |
| HEAD-04      | No interception on headed pass; no consecutive headers   | unit               | `npx vitest run -t "HEAD-04"`                         | ✅ covered by ELIGIBLE_NEXT_ACTIONS tests           |
| HEAD-05      | Contested piece excluded from next movement              | unit               | `npx vitest run -t "HEAD-05\|contestedPieceIds"`      | ✅ existing                                         |
| D-15 (CR-01) | startReplayStream uses liveRoom not captured room        | unit               | `npx vitest run -t "replay.*stream\|CR-01"`           | ❌ Wave 0 — new handler test needed                 |
| D-17 (WR-02) | Intermediate slot transitions reset lastActionType       | unit               | `npx vitest run -t "lastActionType.*slot\|WR-02"`     | ❌ Wave 0 — new engine test needed                  |
| D-21         | pickWinner uses injected die, not Math.random            | unit               | `npx vitest run -t "pickWinner\|tiebreak"`            | ❌ Wave 0 — new engine test                         |
| D-22         | GOAL appended to eventLog                                | unit               | `npx vitest run -t "GOAL.*eventLog\|D-22"`            | ❌ Wave 0 — new engine test                         |
| D-29         | One steal/tackle per piece per phase                     | unit               | `npx vitest run -t "stealAttemptedByIds\|one.*steal"` | ❌ Wave 0 — new engine test                         |

### Wave 0 Gaps

- [ ] New test: `gameEngine.phase10.test.ts` — covers SNAP_DEFLECT phase transition, HEAD-03 goal-line redirect, D-22 GOAL eventLog, D-21 pickWinner determinism, D-17 lastActionType reset, D-23 HEADER LOOSE_BALL lastActionType
- [ ] New test: `gameHandlers.phase10.test.ts` — covers CR-01 stale-reference fix (mock getRoom), D-24 GAME_RESTART_MOVEMENT snap-back, new GK_DIVING handler guards, SNAP_DEFLECT GAME_MOVE guard, HEADER target-hex handler
- [ ] New integration test entries in `game.integration.test.ts` — covers D-25 (fix 3 failing tests using real squad positions), plus end-to-end SHOT_DECLARED → GK_DIVING → resolution smoke test

### Sampling Rate

- **Per task commit:** `cd packages/server && npx vitest run` (full server suite, ~5s)
- **Per wave merge:** `pnpm -r test` (all packages)
- **Phase gate:** Full suite green before `/gsd-verify-work`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                          |
| --------------------- | ------- | ----------------------------------------------------------------------------------------- |
| V2 Authentication     | No      | —                                                                                         |
| V3 Session Management | No      | —                                                                                         |
| V4 Access Control     | Yes     | `isActivePlayer` + team guard on all new handlers; `controlsGKTeam` pattern for GK_DIVING |
| V5 Input Validation   | Yes     | HexCoord shape validation (typeof q/r === 'number') on all new emitted hex payloads       |
| V6 Cryptography       | Yes     | All dice via `rollDice()` → `crypto.randomInt` — never generate on client or in engine    |

### Known Threat Patterns for This Phase

| Pattern                                                  | STRIDE            | Standard Mitigation                                                                        |
| -------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------ |
| Wrong team submits GK dive hex                           | Spoofing          | `controlsGKTeam(socket, room)` guard before accepting `GAME_GK_DIVE`                       |
| Attacker submits header target hex for wrong team's goal | Tampering         | Server validates `headerTargetHex` is goal-line hex for **attackingTeam**'s goal direction |
| Client submits fabricated deflection results             | Tampering         | Server pre-generates all dice; engine is pure; client sends no dice values                 |
| Double-click shot declaration race                       | Denial of Service | `isProcessing` mutex on `GAME_SHOT` handler (already mandatory pattern)                    |
| Off-pitch GK dive hex                                    | Tampering         | `PITCH_HEXES.some(h => h.q === to.q && h.r === to.r)` check                                |

---

## Assumptions Log

| #   | Claim                                                                                                  | Section                             | Risk if Wrong                                                                   |
| --- | ------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------- |
| A1  | Goal mouth hexes are `r ∈ [10..16]` at `q=0` or `q=36`                                                 | Open Questions #1, Code Examples #4 | HEAD-03 goal detection triggers on wrong hexes; fix is a config constant change |
| A2  | GK dive "parallel to goal line" means constant `q`, varying `r`                                        | Open Questions #2, Pitfall 1        | GK could reposition diagonally; breaks shot physics but doesn't crash           |
| A3  | Two defender bands exist: on-path (easier) and within-1-hex-of-path (harder)                           | Open Questions #3, Pattern 4        | Defender deflection either over- or under-powered vs. rulebook intent           |
| A4  | Intermediate slot transition `lastActionType` reset bug is at line 588–599 (non-ATTACKER_2 return)     | Pitfall 6 / Code Examples #3        | Fix targets wrong location; `tsc` will catch type errors but not missing field  |
| A5  | HEADER LOOSE_BALL `lastActionType: 'HEADER'` bug is in the `attackerScore === defenderScore` branch    | Pitfall 6                           | Wrong branch fixed; bug persists                                                |
| A6  | `d4 = rollDice()` as a 4th pre-generated die for header tie-breaking is the correct injection approach | Pattern 4, Pitfall 7                | Alternative: extend applyRoll signature to accept arbitrary dice array          |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (This table is not empty — A1–A6 need confirmation against physical rulebook or PITCH_REGIONS source.)

---

## Sources

### Primary (HIGH confidence)

- Codebase direct reading: `packages/shared/src/types.ts`, `packages/shared/src/events.ts`, `packages/shared/src/actionSequence.ts`, `packages/shared/src/shotValidator.ts` — all GamePhase values, GameState fields, ClientEvents, validator signatures confirmed directly
- Codebase direct reading: `packages/server/src/gameEngine.ts` SHOT branch (lines 1010–1132), HEADER branch (lines 1141–1383), LOOSE_BALL branch, applyEndTurn (lines 500–599), applySnapshot (lines 1654–1719) — implementation status of all requirements confirmed
- Codebase direct reading: `packages/server/src/gameHandlers.ts` GAME_SHOT handler (lines 750–785), GAME_SNAPSHOT handler (lines 1011–1041), HIGH_PASS_MOVEMENT pattern (lines 255–316) — exact patterns to replicate
- Codebase direct reading: `packages/client/src/components/ActionPanel.tsx` — disabled buttons, phase conditions confirmed
- `.planning/phases/08-match-lifecycle-post-game-replay/08-REVIEW.md` — CR-01/WR-01/WR-02/WR-03/WR-04/IN-01 exact file/line references confirmed
- `.planning/phases/08.2-passing-cleanup-inserted/08.2-VERIFICATION.md` — D-21/D-22/D-23/D-24 deferred items confirmed
- `.planning/phases/08.2-passing-cleanup-inserted/deferred-items.md` — 3 failing integration test root causes confirmed

### Secondary (MEDIUM confidence)

- `.planning/phases/10-remaining-action-flows-tech-debt/10-CONTEXT.md` — 30 locked decisions, all implementation requirements

### Tertiary (LOW confidence)

- All `[ASSUMED]` tagged claims in this document — derived from codebase reading and pattern analysis but not cross-referenced against external authoritative sources (rulebook, official docs)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all existing, well-known tools
- Architecture patterns: HIGH — all patterns directly observed in existing codebase (HIGH_PASS_MOVEMENT, isProcessing, broadcastState)
- Pitfalls: HIGH for pitfalls derived from code review docs; MEDIUM for geometry-related pitfalls (A1–A3 assumptions)
- New FSM phases: MEDIUM — structure clear from CONTEXT.md decisions; exact implementation shape is Claude's discretion

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (stable codebase, no fast-moving dependencies)
