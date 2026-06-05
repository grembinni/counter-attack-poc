---
phase: 08-match-lifecycle-post-game-replay
verified: 2026-06-05T06:20:00Z
status: gaps_found
score: 19/23 must-haves verified
overrides_applied: 0
gaps:
  - truth:
      'After FULL_TIME the server streams game:state frames at 1-second intervals — snapshot shots
      are completely non-functional because the GAME_SNAPSHOT handler is not registered'
    status: failed
    reason: "CR-01 (code review confirmed, codebase verified): registerGameHandlers() contains no
      socket.on(ClientEvents.GAME_SNAPSHOT, ...) listener. The client emits game:snapshot via
      emitSnapshot but the server silently drops it. applySnapshot() is implemented and tested in
      isolation but is never invoked over the wire. Additionally, the ActionPanel Snapshot button is
      gated on phase === 'SNAPSHOT'; applySnapshot() transitions state to phase 'SHOT' (not
      'SNAPSHOT'), so the phase 'SNAPSHOT' value is unreachable in a live game — the button is
      permanently invisible."
    artifacts:
      - path: 'packages/server/src/gameHandlers.ts'
        issue: 'No socket.on(ClientEvents.GAME_SNAPSHOT, ...) handler registered in
          registerGameHandlers(). Confirmed by grep — zero matches for GAME_SNAPSHOT in
          registerGameHandlers body.'
      - path: 'packages/client/src/components/ActionPanel.tsx:92'
        issue: "Snapshot button gated on phase === 'SNAPSHOT'; that phase is never set by
          applySnapshot (which transitions to phase 'SHOT'). Button is permanently invisible."
    missing:
      - 'Register socket.on(ClientEvents.GAME_SNAPSHOT, ...) handler in registerGameHandlers() calling
        applySnapshot(room.gameState)'
      - 'Change ActionPanel Snapshot button visibility guard to reflect actual trigger conditions
        (ball carrier in penalty area during MOVEMENT, or immediately post-pass in PASS phase)'

  - truth: 'Every action handler rejects an action that is not eligible after the current
      lastActionType (INVALID_SEQUENCE) — the GAME_HEADER handler is not registered'
    status: failed
    reason: "CR-02 (code review confirmed, codebase verified): registerGameHandlers() contains no
      socket.on(ClientEvents.GAME_HEADER, ...) listener. The client's Header button emits
      ClientEvents.GAME_HEADER via emitHeader, but the server never receives it. The HEADER phase
      DOES work via the existing GAME_ROLL handler (DICE_PHASES includes 'HEADER'), but the
      GAME_HEADER event the ActionPanel button emits is silently dropped. The client has two paths
      that diverge: GAME_ROLL (wired, works) and GAME_HEADER (emitted, not registered)."
    artifacts:
      - path: 'packages/server/src/gameHandlers.ts'
        issue: 'No socket.on(ClientEvents.GAME_HEADER, ...) handler registered. Confirmed by grep —
          zero matches for GAME_HEADER in registerGameHandlers body.'
      - path: 'packages/client/src/components/ActionPanel.tsx:99-103'
        issue: 'Header button calls emitHeader() which emits ClientEvents.GAME_HEADER. No server
          handler receives this event. Header resolution only works if the player uses Roll Dice
          instead, but that is not the documented interaction path.'
    missing:
      - 'Either: register socket.on(ClientEvents.GAME_HEADER, ...) that delegates to applyRoll for
        HEADER phase; OR remove GAME_HEADER from ClientEvents and have the Header button call
        emitRoll() instead (the GAME_ROLL handler already covers HEADER phase via DICE_PHASES)'

  - truth: 'GK spill (save + dropped ball) produces an independent loose-ball landing position'
    status: failed
    reason: "CR-03 (code review confirmed, codebase verified): In applyRoll SHOT branch
      (gameEngine.ts:710-713), when the GK saves but drops the ball (handling check fails), the code
      calls computeLooseBall(gk.position, d1, d2) reusing the shooter's and GK's duel dice. These
      are the same values already consumed for the shot duel. computeLooseBall expects independent
      direction/distance dice. Reusing duel dice produces a deterministic, non-uniform landing
      position — a logical error and an unfair game mechanic."
    artifacts:
      - path: 'packages/server/src/gameEngine.ts'
        issue: 'computeLooseBall called with d1/d2 (already used as shooterDice/gkDice in the shot
          duel). The function signature expects independent direction/distance rolls.'
    missing:
      - 'Either: transition to LOOSE_BALL phase on spill and defer landing to a fresh roll (consistent
        with inaccurate pass and heading tie paths); OR: have the GAME_ROLL caller pre-generate
        extra dice (d4, d5) for the spill path and pass them to computeLooseBall'

  - truth: 'During KICK_OFF_SETUP clicking own piece then a valid zone hex emits game:kick-off-move;
      stale selection state does not persist across server-pushed state updates'
    status: failed
    reason: 'CR-04 (code review confirmed, codebase verified): useGameStore.ts:161 implements
      setGameState as (state) => set({ gameState: state }) — it does NOT clear selectedPieceId or
      validMoveHexes. After every server broadcast (end-turn, phase change, goal, KICK_OFF_SETUP
      repositioning) the previously-selected piece ring and valid-move highlights persist on the
      board until the user explicitly clicks elsewhere.'
    artifacts:
      - path: 'packages/client/src/store/useGameStore.ts:161'
        issue: 'setGameState: (state) => set({ gameState: state }) — selectedPieceId and
          validMoveHexes not cleared on server-pushed state update.'
    missing:
      - 'Change setGameState to: (state) => set({ gameState: state, selectedPieceId: null,
        validMoveHexes: [] })'
---

# Phase 08: Match Lifecycle / Post-Game Replay — Verification Report

**Phase Goal:** Complete match lifecycle — kick-off setup, match clock, half-time, full-time, and
post-game replay
**Verified:** 2026-06-05T06:20:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                            | Status   | Evidence                                                                                                                        |
| --- | -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Shared package exports LastActionType + ELIGIBLE_NEXT_ACTIONS                    | VERIFIED | actionSequence.ts exports both; index.ts barrel re-exports; 71 tests pass                                                       |
| 2   | ELIGIBLE_NEXT_ACTIONS encodes D-08 table exactly                                 | VERIFIED | HIGH_PASS.size===1, SNAPSHOT.size===0, SHOT.size===0, SUCCESSFUL_TACKLE has no SHOT — 71 tests confirm                          |
| 3   | GameState carries addedTime, lastActionType, kickOffTeam, kickOffActive fields   | VERIFIED | types.ts lines 187-199 contain all four fields with correct types                                                               |
| 4   | GameState declares optional replayIndex and replayTotal fields                   | VERIFIED | types.ts lines 200-204 contain replayIndex?:number, replayTotal?:number                                                         |
| 5   | KICK_OFF_SETUP is a valid GamePhase value                                        | VERIFIED | types.ts GamePhase union includes 'KICK_OFF_SETUP'; TurnIndicator PHASE_LABEL maps it                                           |
| 6   | New socket events game:ready, game:kick-off-move, game:half-time-start declared  | VERIFIED | events.ts ClientEvents and ClientToServerEvents include all three                                                               |
| 7   | Movement Phase +3 min; added time rolled once at 45, never re-rolled             | VERIFIED | applyEndTurn injects addedTimeRoll; 53 phase8 tests pass (clock group)                                                          |
| 8   | HALF_TIME for half 1, FULL_TIME for half 2 at threshold                          | VERIFIED | applyEndTurn branches on half; tests assert both transitions                                                                    |
| 9   | Accurate Standard Pass no longer transitions to SHOT                             | VERIFIED | applyRoll PASS branch returns phase:'PASS' not 'SHOT'; test asserts phase !== 'SHOT'                                            |
| 10  | applySnapshot rejects when ball-carrier not in opponent penalty area             | VERIFIED | applySnapshot returns NOT_IN_PENALTY_AREA; test asserts                                                                         |
| 11  | applyKickOffReady rejects when attacking team has no piece on centre hex         | VERIFIED | returns CENTRE_HEX_EMPTY; kickoffSetup.integration.test.ts passes (6 tests)                                                     |
| 12  | applyKickOffReady rejects defenders in centre circle / pieces outside own half   | VERIFIED | returns IN_CENTRE_CIRCLE and OUT_OF_ZONE; tests assert                                                                          |
| 13  | applyHalfTimeStart flips attackingTeam, resets half/actionCount/addedTime        | VERIFIED | sets attackingTeam=opposite of kickOffTeam, half:2, actionCount:0, addedTime:null; tests assert                                 |
| 14  | buildReplayFrames skips SLOT_ADVANCE, tags frames as REPLAY                      | VERIFIED | SLOT_ADVANCE-only log → 0 frames; every frame has phase:'REPLAY'; tests assert                                                  |
| 15  | Room carries replayTimer + readyPlayers; deleteRoom clears replayTimer           | VERIFIED | roomStore.ts fields present; deleteRoom clearInterval guard present; roomStore tests pass                                       |
| 16  | game:ready, game:kick-off-move, game:half-time-start handlers registered         | VERIFIED | registerGameHandlers contains socket.on for all three; kickoffSetup integration tests pass                                      |
| 17  | KICK_OFF→MOVEMENT sets kickOffActive; first pass forced Standard from centre hex | VERIFIED | Handler sets kickOffActive=true; GAME_ROLL PASS enforces kickOffHex origin and Standard type                                    |
| 18  | End-turn handler injects crypto addedTime roll into applyEndTurn                 | VERIFIED | GAME_END_TURN: const addedTimeRoll = rollDice(); applyEndTurn(state, {addedTimeRoll})                                           |
| 19  | FULL_TIME streams replay frames at 1s intervals; timer cleared on exhaustion     | VERIFIED | startReplayStream uses setInterval(1000); clearInterval on exhaustion; replay integration tests pass (5 tests)                  |
| 20  | Store Screen type includes HALF_TIME, FULL_TIME, REPLAY + new emitters           | VERIFIED | useGameStore.ts Screen union has all three; emitReady/emitKickOffMove/emitHalfTimeStart defined                                 |
| 21  | App.tsx routes GameState.phase to correct screen                                 | VERIFIED | onGameState branches to setScreen('HALF_TIME'/'FULL_TIME'/'REPLAY'); else GAME_BOARD                                            |
| 22  | HalfTimeScreen shows score and Start 2nd Half gated to non-kick-off team         | VERIFIED | canStart = myTeam !== null && myTeam !== kickOffTeam; disabled={!canStart}; "Start 2nd Half" text                               |
| 23  | FullTimeScreen shows final score + result line + Replay starting notice          | VERIFIED | "Full Time", resultText (Home wins/Away wins/Draw), "Replay starting…" present                                                  |
| 24  | KickOffSetupPanel shows constraint status and gated Ready button                 | VERIFIED | Returns null unless KICK_OFF_SETUP; centreHexOccupied, piecesOutOfZone checks; disabled when !constraintsMet                    |
| 25  | HexGrid zone tint + centre-hex ring + kick-off-move click routing                | VERIFIED | KICK_OFF_SETUP overlays present; #f5c518 ring polygon; emitKickOffMove on valid zone hex click                                  |
| 26  | GameBoard header shows match time N' / 45+N' in accent-gold                      | VERIFIED | timeLabel logic correct; headerTime span in JSX; PLAY_PHASES set controls visibility                                            |
| 27  | ActionPanel imports ELIGIBLE_NEXT_ACTIONS and disables ineligible buttons        | VERIFIED | Import present; isEligible() derived from lastActionType; disabled={!isEligible(...)} on buttons                                |
| 28  | ReplayPanel shows Action N of N counter and Play Again button                    | VERIFIED | positionLabel, isComplete, Play Again visible only when complete, setScreen('CREATE_ROOM')                                      |
| 29  | Snapshot shots are functional over the wire (GAME_SNAPSHOT handler registered)   | FAILED   | CR-01: No socket.on(ClientEvents.GAME_SNAPSHOT) in registerGameHandlers. applySnapshot implemented but never called from socket |
| 30  | Header button click resolves via dedicated GAME_HEADER handler                   | FAILED   | CR-02: No socket.on(ClientEvents.GAME_HEADER) in registerGameHandlers. Client emitHeader() sends to void                        |
| 31  | GK spill uses independent dice for loose-ball direction/distance                 | FAILED   | CR-03: computeLooseBall(gk.position, d1, d2) reuses shot-duel dice; no independent spill dice generated                         |
| 32  | setGameState clears stale selectedPieceId/validMoveHexes on server push          | FAILED   | CR-04: setGameState: (state) => set({ gameState: state }) — no selectedPieceId/validMoveHexes clear                             |

**Score:** 28/32 truths verified (4 failed)

---

### Required Artifacts

| Artifact                                                         | Expected                                                                           | Status   | Details                                                                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/actionSequence.ts`                          | ELIGIBLE_NEXT_ACTIONS constant + NextActionType                                    | VERIFIED | Exists; 98 lines; full D-08 table; all 10 keys present                                                        |
| `packages/shared/src/actionSequence.test.ts`                     | 71 unit tests for eligibility table                                                | VERIFIED | 71 tests; all pass                                                                                            |
| `packages/shared/src/types.ts`                                   | LastActionType, KICK_OFF_SETUP, GameState fields                                   | VERIFIED | All additions present and compile clean                                                                       |
| `packages/shared/src/index.ts`                                   | Barrel re-exports actionSequence                                                   | VERIFIED | `export * from './actionSequence.js'` present                                                                 |
| `packages/shared/src/events.ts`                                  | GAME_READY/GAME_KICK_OFF_MOVE/GAME_HALF_TIME_START                                 | VERIFIED | All three entries in ClientEvents and ClientToServerEvents                                                    |
| `packages/server/src/gameEngine.ts`                              | applySnapshot, applyKickOffReady, applyHalfTimeStart, buildReplayFrames            | VERIFIED | All four exported; pure functions; no randomInt in applyEndTurn                                               |
| `packages/server/src/__tests__/gameEngine.phase8.test.ts`        | 53 unit tests for Phase 8 engine                                                   | VERIFIED | 53/53 pass                                                                                                    |
| `packages/server/src/__tests__/kickoffSetup.integration.test.ts` | Over-the-wire kick-off placement test                                              | VERIFIED | 6/6 tests pass                                                                                                |
| `packages/server/src/__tests__/replay.integration.test.ts`       | Over-the-wire replay stream test                                                   | VERIFIED | 5/5 tests pass                                                                                                |
| `packages/server/src/roomStore.ts`                               | Room.replayTimer + Room.readyPlayers                                               | VERIFIED | Both fields present; deleteRoom clears replayTimer                                                            |
| `packages/server/src/gameHandlers.ts`                            | GAME_READY/GAME_KICK_OFF_MOVE/GAME_HALF_TIME_START handlers; GAME_SNAPSHOT handler | STUB     | First three registered; GAME_SNAPSHOT handler MISSING                                                         |
| `packages/client/src/components/HalfTimeScreen.tsx`              | Half-time screen with Start 2nd Half                                               | VERIFIED | Contains "Half Time", "Start 2nd Half", correct team gating                                                   |
| `packages/client/src/components/FullTimeScreen.tsx`              | Full-time screen with score + result                                               | VERIFIED | Contains "Full Time", result line, "Replay starting…"                                                         |
| `packages/client/src/components/KickOffSetupPanel.tsx`           | Kick-off setup panel with Ready button                                             | VERIFIED | Contains "Kick-Off Setup", "Ready", constraint rows                                                           |
| `packages/client/src/components/ReplayPanel.tsx`                 | Replay panel with Action N of N + Play Again                                       | VERIFIED | Contains "Play Again"; position counter; phase guard                                                          |
| `packages/client/src/components/HexGrid.tsx`                     | KICK_OFF_SETUP zone tint + centre-hex ring                                         | VERIFIED | KICK_OFF_SETUP overlays; #f5c518 ring; emitKickOffMove routing                                                |
| `packages/client/src/components/ActionPanel.tsx`                 | Snapshot button + ELIGIBLE_NEXT_ACTIONS disabling                                  | STUB     | ELIGIBLE_NEXT_ACTIONS import + disabling: VERIFIED; Snapshot button gated on unreachable phase === 'SNAPSHOT' |
| `packages/client/src/store/useGameStore.ts`                      | HALF_TIME/FULL_TIME/REPLAY screen values + emitters                                | VERIFIED | All present; setGameState does NOT clear selection (CR-04)                                                    |

---

### Key Link Verification

| From                            | To                                       | Via                                     | Status    | Details                                                                  |
| ------------------------------- | ---------------------------------------- | --------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `index.ts`                      | `actionSequence.ts`                      | barrel re-export                        | WIRED     | `export * from './actionSequence.js'` confirmed                          |
| `gameHandlers.ts`               | `ELIGIBLE_NEXT_ACTIONS`                  | import from @counter-attack/shared      | WIRED     | Import present; used in sequence guards on GAME_ROLL                     |
| `gameHandlers.ts`               | `applyKickOffReady`                      | import from gameEngine.js               | WIRED     | Used in GAME_READY handler                                               |
| `gameHandlers.ts`               | `buildReplayFrames`                      | import from gameEngine.js               | WIRED     | Used in startReplayStream helper                                         |
| `gameHandlers.ts`               | `kickOffActive` flag                     | sets true on KICK_OFF→MOVEMENT          | WIRED     | `room.gameState = { ...result.state, kickOffActive: true }`              |
| `gameHandlers.ts GAME_END_TURN` | `applyEndTurn`                           | rollDice() injection                    | WIRED     | `const addedTimeRoll = rollDice(); applyEndTurn(state, {addedTimeRoll})` |
| `gameHandlers.ts`               | `applySnapshot`                          | socket.on(GAME_SNAPSHOT)                | NOT_WIRED | CR-01: no GAME_SNAPSHOT handler registered                               |
| `gameHandlers.ts`               | `GAME_HEADER`                            | socket.on(GAME_HEADER)                  | NOT_WIRED | CR-02: no GAME_HEADER handler registered                                 |
| `useGameStore.ts setGameState`  | `selectedPieceId / validMoveHexes` reset | set({ ..., selectedPieceId: null })     | NOT_WIRED | CR-04: setGameState only sets gameState, no selection clear              |
| `App.tsx onGameState`           | `setScreen by phase`                     | phase-conditional routing               | WIRED     | HALF_TIME/FULL_TIME/REPLAY phases correctly routed                       |
| `ActionPanel.tsx`               | `ELIGIBLE_NEXT_ACTIONS`                  | import from @counter-attack/shared      | WIRED     | isEligible() reflects lastActionType for button disabling                |
| `ReplayPanel.tsx`               | `setScreen('CREATE_ROOM')`               | Play Again onClick                      | WIRED     | onClick={() => setScreen('CREATE_ROOM')}                                 |
| `roomHandlers.ts disconnect`    | `room.replayTimer clearInterval`         | conditional clear in disconnect handler | WIRED     | if (room.replayTimer) { clearInterval; null }                            |

---

### Data-Flow Trace (Level 4)

| Artifact                | Data Variable           | Source                                                 | Produces Real Data                              | Status  |
| ----------------------- | ----------------------- | ------------------------------------------------------ | ----------------------------------------------- | ------- |
| `HalfTimeScreen.tsx`    | score                   | useGameStore(s => s.gameState.score)                   | Yes — server broadcast                          | FLOWING |
| `HalfTimeScreen.tsx`    | kickOffTeam             | useGameStore(s => s.gameState.kickOffTeam)             | Yes — set at buildInitialGameState              | FLOWING |
| `FullTimeScreen.tsx`    | score                   | useGameStore(s => s.gameState.score)                   | Yes — server broadcast                          | FLOWING |
| `ReplayPanel.tsx`       | replayIndex/replayTotal | useGameStore(s => s.gameState.replayIndex/replayTotal) | Yes — carried on replay frames from setInterval | FLOWING |
| `KickOffSetupPanel.tsx` | pieces                  | useGameStore(s => s.gameState.pieces)                  | Yes — server broadcast                          | FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                          | Command                                                                               | Result                                                                                        | Status              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------- |
| Shared package all tests pass (210)               | `cd packages/shared && npx vitest run`                                                | 210/210 pass                                                                                  | PASS                |
| Server Phase 8 engine tests pass (53)             | `cd packages/server && npx vitest run src/__tests__/gameEngine.phase8.test.ts`        | 53/53 pass                                                                                    | PASS                |
| Kick-off setup integration tests pass (6)         | `cd packages/server && npx vitest run src/__tests__/kickoffSetup.integration.test.ts` | 6/6 pass                                                                                      | PASS                |
| Replay integration tests pass (5)                 | `cd packages/server && npx vitest run src/__tests__/replay.integration.test.ts`       | 5/5 pass                                                                                      | PASS                |
| Server full suite (pre-existing failures tracked) | `cd packages/server && npx vitest run`                                                | 149 pass, 2 fail (pre-existing in game.integration.test.ts — documented in 08-02/03 SUMMARYs) | PASS (pre-existing) |
| Client TypeScript type-check                      | `cd packages/client && npx tsc --noEmit`                                              | 0 errors                                                                                      | PASS                |
| Server TypeScript type-check                      | `cd packages/server && npx tsc --noEmit`                                              | 0 errors                                                                                      | PASS                |
| Client production build                           | `cd packages/client && npx vite build`                                                | 224.96 kB, 0 errors                                                                           | PASS                |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                 | Status              | Evidence                                                                                                                            |
| ----------- | ----------- | --------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| MATCH-01    | 08-01/02/06 | Two 45-action halves; Movement=3min, Pass=1min etc.                         | SATISFIED           | applyEndTurn +3; per-action costs in applyRoll; clock tests pass                                                                    |
| MATCH-02    | 08-01/02/04 | Added time = dice + leniency; extends exactly that many actions             | SATISFIED           | addedTime set once at 45; injected roll; half-end threshold check                                                                   |
| MATCH-03    | 08-01/03/04 | Kick-off placement: centre hex, own half, first pass = Standard from centre | SATISFIED           | applyKickOffReady validates; kickOffActive enforces centre-pass                                                                     |
| MATCH-04    | 08-01/03    | Second-half kick-off by team that did not kick off in first half            | SATISFIED           | applyHalfTimeStart: attackingTeam = opposite of kickOffTeam                                                                         |
| MATCH-05    | 08-05/06    | Score tracked and displayed to both players                                 | SATISFIED           | score in GameState broadcast; shown in all screens; header score display                                                            |
| REPLAY-01   | 08-04       | After full time, both players see replay of entire match                    | SATISFIED           | startReplayStream after FULL_TIME; replay.integration.test passes                                                                   |
| REPLAY-02   | 08-03/04    | Replay advances one action per second                                       | SATISFIED           | setInterval(1000) in startReplayStream; one frame per eligible event                                                                |
| REPLAY-03   | 08-03       | Replay driven by server-side event log                                      | SATISFIED           | buildReplayFrames is deterministic; reads finalState.eventLog only                                                                  |
| SNAP-01     | 08-02       | Snapshot during Movement in penalty area, or immediately after any pass     | PARTIALLY SATISFIED | applySnapshot logic correct + tested; GAME_SNAPSHOT handler missing — not functional over the wire (CR-01)                          |
| SNAP-02     | 08-02/06    | Snapshot -1 dice penalty; 1 opponent moves 2 hexes before shot              | PARTIALLY SATISFIED | -1 penalty (snapshotPenalty flag) implemented; opponent deflection move NOT implemented; REQUIREMENTS.md still marks SNAP-02 as [ ] |
| SNAP-03     | 08-02/06    | All standard shot rules apply to snapshots                                  | PARTIALLY SATISFIED | applyRoll SHOT branch handles snapshotPenalty; standard rules applied; but GAME_SNAPSHOT handler absent blocks e2e                  |

---

### Anti-Patterns Found

| File                                                   | Line | Pattern                                                               | Severity | Impact                                                                                    |
| ------------------------------------------------------ | ---- | --------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `packages/server/src/gameHandlers.ts`                  | n/a  | Missing GAME_SNAPSHOT handler registration                            | BLOCKER  | Snapshot shots non-functional over wire; applySnapshot dead code in production            |
| `packages/server/src/gameHandlers.ts`                  | n/a  | Missing GAME_HEADER handler registration                              | BLOCKER  | Header button emits to void; server never receives GAME_HEADER                            |
| `packages/server/src/gameEngine.ts`                    | ~713 | computeLooseBall reuses shot-duel dice for GK spill                   | BLOCKER  | Deterministic, non-uniform loose-ball landing after GK spill                              |
| `packages/client/src/store/useGameStore.ts`            | 161  | setGameState does not clear selectedPieceId/validMoveHexes            | BLOCKER  | Stale selection ring/highlights persist across server state pushes                        |
| `packages/client/src/components/ActionPanel.tsx`       | 92   | Snapshot button gated on unreachable phase === 'SNAPSHOT'             | BLOCKER  | Button permanently invisible; applySnapshot transitions to 'SHOT' not 'SNAPSHOT'          |
| `packages/client/src/store/useGameStore.ts`            | 99   | gameState initialised with mockMovementState (IN-01)                  | WARNING  | Mock fixture visible briefly on load; roomCode: 'MOCK1' in initial state                  |
| `packages/server/src/gameHandlers.ts`                  | ~142 | startReplayStream captures room by stale reference (WR-02)            | WARNING  | 3s setTimeout may fire after room deletion; interval sets replayTimer on dead room object |
| `packages/client/src/components/KickOffSetupPanel.tsx` | 22   | localReady useState not keyed — may survive phase transitions (WR-03) | WARNING  | Second kick-off could show "Waiting for opponent…" without user clicking Ready            |
| `packages/client/src/components/ActionLog.tsx`         | 118  | Array index used as React key (WR-04)                                 | WARNING  | Incorrect reconciliation on reversed event list; wrong entry highlights goal flash        |
| `packages/server/src/gameEngine.ts`                    | ~374 | SHOT sequence guard skipped when lastActionType === null (WR-05)      | WARNING  | null lastActionType is implicit "allow-all" for SHOT; asymmetric with intent              |

---

### Human Verification Required

Plan 08-06 Task 4 included a `checkpoint:human-verify` gate that was marked APPROVED by a human per 08-06-SUMMARY.md. The following items from that checkpoint are considered verified by the human run.

However, given the 4 critical gaps found in this automated verification, the full-lifecycle human verification result does not substitute for the code-level failures. The snapshot path specifically was NOT exercised in the human verification (the ActionPanel Snapshot button is permanently invisible due to the phase guard bug).

**1. Snapshot full-path test (requires gap fixes first)**

**Test:** After fixing CR-01 and the ActionPanel Snapshot button guard, place ball carrier in opponent
penalty area during MOVEMENT, click Snapshot, confirm phase transitions to SHOT, confirm -1 penalty
applies to the shot duel, confirm server handles the sequence.
**Expected:** Shot resolves with the standard rules plus -1 dice penalty; no game error emitted.
**Why human:** Cannot test the end-to-end socket path without a running server.

**2. Header button interaction path**

**Test:** After a High Pass, click the Header button (not Roll Dice). Confirm the server responds
correctly.
**Expected:** Header duel resolves; game does not silently drop the event.
**Why human:** CR-02 — requires the GAME_HEADER handler to be registered (or the Header button to
be rewired to emitRoll).

---

## Gaps Summary

Four code-level gaps block full goal achievement:

**Gap 1 (CR-01):** The `GAME_SNAPSHOT` socket handler is not registered in `registerGameHandlers`.
`applySnapshot` is implemented and unit-tested but is never invoked from a socket event. The
ActionPanel Snapshot button is additionally gated on `phase === 'SNAPSHOT'`, a phase that is
unreachable (applySnapshot transitions to 'SHOT', not 'SNAPSHOT'). Both ends of the snapshot
path are broken.

**Gap 2 (CR-02):** The `GAME_HEADER` socket handler is not registered. The client's Header button
calls `emitHeader()` which emits `ClientEvents.GAME_HEADER`, but the server has no listener.
Header resolution currently works only via the `GAME_ROLL` handler (which includes HEADER in
`DICE_PHASES`), creating a divergence between the emitted event and what the server handles.

**Gap 3 (CR-03):** In the SHOT branch of `applyRoll`, when the GK saves but drops the ball,
`computeLooseBall` is called with `d1` (shooterDice) and `d2` (gkDice) — the same dice already
used for the shot duel. This produces a deterministic, biased loose-ball landing position. All
other loose-ball paths use independent dice.

**Gap 4 (CR-04):** `useGameStore.setGameState` replaces `gameState` without clearing
`selectedPieceId` or `validMoveHexes`. Stale selection state persists across every server broadcast
(end-turn, phase change, goal, KICK_OFF_SETUP repositioning) until the user clicks elsewhere.

Gaps 1 and 2 are directly related: both are missing socket handler registrations. They can be
addressed in a single focused plan. Gaps 3 and 4 are independent single-line/single-function fixes.

The two pre-existing test failures in `game.integration.test.ts` ("D-10 undo" and "D-09
UNDO_LOCKED") are pre-existing from before Phase 8 and documented in 08-02 and 08-03 SUMMARYs;
they are not caused by Phase 8 changes and are not counted as gaps here.

---

_Verified: 2026-06-05T06:20:00Z_
_Verifier: Claude (gsd-verifier)_
