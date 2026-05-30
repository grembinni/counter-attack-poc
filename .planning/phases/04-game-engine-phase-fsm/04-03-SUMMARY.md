---
plan: 04-03
phase: 04-game-engine-phase-fsm
status: complete
completed: 2026-05-29
commits:
  - 6afc979
  - 81d8b3a
  - ed66e13
key-files:
  created:
    - packages/server/src/gameHandlers.ts
  modified:
    - packages/server/src/roomStore.ts
    - packages/server/src/createServer.ts
    - packages/server/src/__tests__/game.integration.test.ts
    - packages/server/src/__tests__/room.integration.test.ts
    - packages/server/src/__tests__/roomStore.test.ts
requirements-delivered: [TEAM-01, PITCH-02, PITCH-03]
---

## Summary

Wired the Wave 2 game engine to Socket.io. Full Movement Phase runs end-to-end.

## What Was Built

**Task 1 — gameHandlers.ts:**

- `registerGameHandlers(io, socket)` with 4 handlers: GAME_START_MOVEMENT, GAME_MOVE, GAME_END_TURN, GAME_UNDO
- Each handler: isProcessing mutex (SC-5 drop + Pitfall 5 finally release), active-player/attacking-team guard, engine call, broadcastState success (ARCH-04), GAME_ERROR + snap-back rejection (D-06)
- `socketTeam()`: slot 1 = 'home', slot 2 = 'away'; `actingTeam()`: ATTACKER_4/ATTACKER_2 = attackingTeam, DEFENDER_5 = other
- T-4-05: GAME_START_MOVEMENT restricted to the attacking team's socket
- T-4-01/04: WRONG_TEAM on non-acting sockets for GAME_MOVE/GAME_END_TURN

**Task 2 — roomStore.ts + createServer.ts:**

- `joinRoom` now calls `buildInitialGameState(roomCode)` (D-12/D-14) — LOBBY stub removed
- `registerGameHandlers` called in both fresh and reconnect paths in createServer.ts
- Phase 3 integration tests updated to assert KICK_OFF + 22 pieces (was LOBBY + empty)

**Task 3 — game.integration.test.ts filled:**

- 8 active tests (was 8 todos): KICK_OFF lifecycle, T-4-05 start-movement guard, FSM ATTACKER_4→DEFENDER_5→ATTACKER_2→PASS, T-4-01 WRONG_TEAM, D-10 undo reversal, D-09 UNDO_LOCKED, SC-5 duplicate drop
- 1 remaining `it.todo` for MOVE-06 free-move wire exercise (Phase 5)
- Fixed snap-back race in T-4-05 test by draining the KICK_OFF broadcast before registering the MOVEMENT listener

## Test Results

- `pnpm -r test` → 187 tests all green (130 shared + 57 server; 1 todo)
- `pnpm -r build` → exit 0

## Self-Check: PASSED

All must-haves satisfied:

- ✅ SC-5: isProcessing mutex drops duplicate actions (verified at wire)
- ✅ MOVE-01: out-of-phase move rejected with WRONG_PHASE
- ✅ T-4-01/04: wrong-player actions rejected with WRONG_TEAM
- ✅ T-4-05: only the attacking team can start the Movement Phase
- ✅ FSM: ATTACKER_4→DEFENDER_5→ATTACKER_2→PASS enforced end-to-end over the wire
- ✅ D-09/10: undo boundary + reversal verified over the wire
- ✅ D-12/14: real KICK_OFF GameState built on second-player join
- ✅ registerGameHandlers wired on fresh + reconnect paths
- ✅ Full repo test suite and build green
