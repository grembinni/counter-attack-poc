---
plan: 04-01
phase: 04-game-engine-phase-fsm
status: complete
completed: 2026-05-29
commits:
  - de378e4
  - c09bc6d
  - e3b495b
key-files:
  created:
    - packages/shared/src/teams.ts
    - packages/shared/src/teams.test.ts
    - packages/shared/src/pitch.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/shared/src/index.ts
    - packages/shared/src/pitch.ts
    - packages/shared/src/moveValidator.test.ts
    - packages/shared/src/headingValidator.test.ts
    - packages/shared/src/passValidator.test.ts
    - packages/shared/src/shotValidator.test.ts
    - packages/shared/src/snapshotValidator.test.ts
    - packages/shared/src/hex.test.ts
    - packages/server/src/roomStore.ts
requirements-delivered: [TEAM-01, TEAM-02, TEAM-03, PITCH-01, PITCH-02, PITCH-03]
---

## Summary

Extended `@counter-attack/shared` with all Phase 4 data and type foundations.

## What Was Built

**Task 1 — types.ts, events.ts, index.ts:**

- `ActionEvent` discriminated union (MOVE, SLOT_ADVANCE, DICE_ROLL, STEAL_ATTEMPT, GOAL, KICK_OFF) replaces `readonly unknown[]` eventLog placeholder (D-08)
- `RefereeCard = { leniency: number }` type added (TEAM-03)
- `MovementSlot` exported as named type; `GameState.movementSlot` references it
- `PlayerPiece` gains `name: string` and `role: 'GK' | 'DEF' | 'MID' | 'FWD'` (TEAM-02)
- `GameState` gains `refereeCard: RefereeCard` and `attackingTeam: 'home' | 'away'`
- `ClientEvents` gains GAME_END_TURN, GAME_UNDO, GAME_START_MOVEMENT; `ServerEvents` gains GAME_ERROR
- `GAME_MOVE` signature updated to `(pieceId: string, to: HexCoord) => void` (OQ-1)
- All existing test fixtures and roomStore LOBBY stub updated for new required fields

**Task 2 — teams.ts + teams.test.ts:**

- `HOME_SQUAD` and `AWAY_SQUAD` each with 11 fully-attributed players (TEAM-01)
- IDs `home-0..home-10` / `away-0..away-10`; 1 GK, 4 DEF, 3 MID, 3 FWD per squad
- Role-appropriate attribute ranges (GK: saving 9–10; FWD: pace 8–9, shooting 7–9)
- Placeholder positions on 25×16 grid; Phase 6 replaces with real board coords
- 12-test suite asserts TEAM-01 and TEAM-02 requirements (all green)

**Task 3 — pitch.ts + pitch.test.ts:**

- `PITCH_REGIONS` with 8 Set-encoded regions + `kickOffHex: {q:12,r:7}` (PITCH-02)
- `DIFFICULT_ANGLE_HEXES` — 16 dot-marked positions (PITCH-03)
- `isInRegion`, `isDifficultAngle`, `isPitchHex` predicate helpers; all use `Set.has()` (O(1))
- 15-test suite asserts PITCH-01, PITCH-02, PITCH-03 requirements (all green)

## Test Results

- `pnpm --filter @counter-attack/shared test` → 130 tests, all green
- `pnpm --filter @counter-attack/shared build` → exit 0

## Self-Check: PASSED

All must-haves satisfied:

- ✅ Both squads expose 11 players each with all 9 attributes plus name and role (TEAM-01, TEAM-02)
- ✅ GameState carries RefereeCard type and typed ActionEvent[] eventLog (TEAM-03, D-08)
- ✅ Pitch regions queryable via O(1) Set membership (PITCH-02)
- ✅ Difficult-angle hexes encoded and queryable (PITCH-03)
- ✅ game:end-turn, game:undo, game:error, game:start-movement events typed (Socket.io contracts)
