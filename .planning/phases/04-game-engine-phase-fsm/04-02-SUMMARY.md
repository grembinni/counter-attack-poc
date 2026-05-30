---
plan: 04-02
phase: 04-game-engine-phase-fsm
status: complete
completed: 2026-05-29
commits:
  - 9c0d871
  - e1083a1
key-files:
  created:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.test.ts
    - packages/server/src/__tests__/game.integration.test.ts
  modified:
    - packages/shared/src/types.ts
    - .planning/phases/04-game-engine-phase-fsm/04-RESEARCH.md
requirements-delivered: [TEAM-01, TEAM-03, PITCH-02]
---

## Summary

Created `packages/server/src/gameEngine.ts` — the pure-function core of Phase 4.

## What Was Built

**Task 1+2 — gameEngine.ts (Tasks 1 and 2 combined):**

- `buildInitialGameState(roomCode)`: 22 pieces from HOME_SQUAD+AWAY_SQUAD (TEAM-01), coin-flip attackingTeam (D-13), random refereeCard.leniency 1–6 (TEAM-03), KICK_OFF phase (D-14)
- `advanceMovementSlot(state)`: ATTACKER_4→DEFENDER_5→ATTACKER_2→PASS using SLOT_SEQUENCE array (D-03/D-04)
- `applyStartMovement(state)`: KICK_OFF→MOVEMENT/ATTACKER_4 guard; appends KICK_OFF event (T-4-05 engine layer)
- `applyMove(state, pieceId, to)`: guard-first (WRONG_SLOT/PIECE_NOT_FOUND/WRONG_TEAM/MOVE_INVALID), server-derived from-coord (T-4-03), STEAL_ATTEMPT handling with stubDice, MOVE-06 pendingFreeMove detection (D-15); no auto-advance (D-01)
- `applyEndTurn(state)`: advances slot, resets tracking fields, appends SLOT_ADVANCE event
- `applyUndo(state)`: UNDO_LOCKED after SLOT_ADVANCE or DICE_ROLL (D-09); reverses last MOVE in current slot (D-10); UNDO_LOCKED for prior-slot moves; NOTHING_TO_UNDO when log is empty
- Zero socket.io imports; all functions return discriminated-union results
- Added `pendingFreeMove?: { team, hexesAllowed }` optional field to GameState (D-15/MOVE-06)

**Task 3 — game.integration.test.ts skeleton + RESEARCH resolved:**

- Server lifecycle harness (port 0, beforeEach/afterEach) copied from room.integration.test.ts
- `setupRoom()` async helper: creates 2 clients, joins a room, awaits GAME_STATE broadcast
- 8 `it.todo` placeholders for Wave 3 scenarios (MOVE-01, T-4-05, FSM, T-4-01, D-09/10, SC-5, MOVE-06 deferred)
- RESEARCH.md `## Open Questions` → `## Open Questions (RESOLVED)` with implementation notes

## Test Results

- `pnpm --filter @counter-attack/server test` → 49 tests pass, 8 todos
- `pnpm --filter @counter-attack/server build` → exit 0
- `pnpm -r build` → exit 0

## Self-Check: PASSED

All must-haves satisfied:

- ✅ buildInitialGameState: 22 pieces (TEAM-01), random referee card (TEAM-03), coin-flip attackingTeam (D-13/D-14)
- ✅ applyStartMovement: KICK_OFF→MOVEMENT/ATTACKER_4 (makes Movement Phase reachable over wire)
- ✅ applyMove: re-validates, no auto-advance (D-01/D-06), MOVE-06 free-move state (D-15)
- ✅ FSM: ATTACKER_4→DEFENDER_5→ATTACKER_2→PASS enforced (D-03/D-04)
- ✅ applyUndo: UNDO_LOCKED boundary (D-09) and reversal (D-10) verified in unit tests
- ✅ Integration harness + setupRoom ready for Wave 3 scenarios
- ✅ RESEARCH open questions marked RESOLVED
