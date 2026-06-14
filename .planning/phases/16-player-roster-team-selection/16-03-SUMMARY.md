---
phase: 16-player-roster-team-selection
plan: 03
subsystem: api
tags: [socket.io, team-selection, game-engine, server]

requires:
  - phase: 16-02
    provides: PlayerPiece type surgery, TEAM_SQUADS, GameState.selectedTeams, team socket events

provides:
  - buildInitialGameState(roomCode, selectedTeams) using TEAM_SQUADS with runtime away-mirroring
  - buildKickOffPieces(attackingTeam, selectedTeams) updated to same signature
  - Room.homePickedTeam: slot-2 join no longer builds game state
  - team:selection-start emitted on slot-2 join (CONN-03 D-10)
  - team:pick handler with home-first turn order, allow-list validation, isProcessing mutex

affects: [16-04, client team-selection screen, game integration tests]

tech-stack:
  added: []
  patterns:
    - isProcessing mutex for concurrent socket event protection (SC-5 / TEAM-02)
    - Allow-list ASVS V5 validation for untrusted teamId payload
    - Server-authoritative turn order via playerSlot + homePickedTeam state

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/roomStore.ts
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/gameEngine.test.ts
    - packages/server/src/__tests__/room.integration.test.ts
    - packages/server/src/__tests__/game.integration.test.ts
    - packages/server/src/__tests__/kickoffSetup.integration.test.ts
    - packages/server/src/__tests__/replay.integration.test.ts
    - packages/server/src/__tests__/gameHandlers.test.ts
    - packages/server/src/__tests__/gameHandlers.phase10.test.ts
    - packages/server/src/__tests__/gameHandlers.rule11.test.ts

key-decisions:
  - 'gameState stays null in roomStore until both teams picked (D-10) — broadcastState not called on join'
  - 'Away mirror formula: q_away = 36 - q_home; id: home-N -> away-N'
  - 'isProcessing mutex wraps entire team:pick handler to prevent race conditions (Pitfall 10)'
  - 'buildInitialGameState imported into roomHandlers.ts (previously only in roomStore.ts)'

patterns-established:
  - 'team:pick handler: not-in-room guard → getRoom guard → isProcessing mutex → try/finally → allow-list → turn-order branches'
  - 'Integration tests use setupRoom helpers that drive through TEAM_SELECTION_START → team:pick(home) → team:pick(away) → GAME_STATE'

requirements-completed: [PLAY-01, SELECT-01]

duration: 45min
completed: 2026-06-13
---

# Phase 16-03: Server-Side Team Selection Summary

**Server-authoritative team:pick flow with turn-order enforcement, allow-list validation, and mutex; TEAM_SQUADS squad mapping with runtime away-mirroring in buildInitialGameState**

## Performance

- **Duration:** ~45 min (split across two sessions due to session limit)
- **Completed:** 2026-06-13
- **Tasks:** 2/2
- **Files modified:** 16

## Accomplishments

- `buildInitialGameState(roomCode, selectedTeams)` maps `TEAM_SQUADS[home]` and `TEAM_SQUADS[away]` to home/away pieces with `q_away = 36 - q_home` mirroring and `home-N → away-N` id remapping; embeds `selectedTeams` in returned GameState
- `buildKickOffPieces(attackingTeam, selectedTeams)` updated to same two-arg signature; post-goal reset callers in gameHandlers.ts pass `state.selectedTeams`
- `Room.homePickedTeam?: TeamId` added; `joinRoom` no longer calls `buildInitialGameState` (gameState stays null, D-10)
- Slot-2 join now emits `TEAM_SELECTION_START` to whole room instead of broadcasting game state (CONN-03 updated)
- `team:pick` handler: isProcessing mutex, allow-list validation (`INVALID_TEAM`), home-first turn order (`WRONG_TURN`), duplicate-team guard (`TEAM_ALREADY_PICKED`), and `buildInitialGameState` called only after away pick

## Task Commits

1. **Task 1: gameEngine selectedTeams + repair callers/tests** - `07871a9` (feat)
2. **Task 2: team:selection-start emit + team:pick handler** - `e3c1159` (feat)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — two-arg buildInitialGameState + buildKickOffPieces with TEAM_SQUADS lookup and away mirroring
- `packages/server/src/roomStore.ts` — Room.homePickedTeam added; joinRoom no longer builds gameState
- `packages/server/src/roomHandlers.ts` — CONN-03 updated; team:pick handler added
- All server test files — fixtures updated to firstName/lastName/number/nationality; setupRoom helpers drive through team:pick flow

## Decisions Made

- `buildInitialGameState` imported into `roomHandlers.ts` (only called in the away-pick branch)
- Integration test helpers all unified to the TEAM_SELECTION_START → 2× team:pick → GAME_STATE flow (no helper builds state directly)

## Deviations from Plan

None — plan executed as specified. One minor cosmetic fix to teams.ts trailing comma included in Task 2 commit.

## Issues Encountered

Session limit interrupted the executor mid-Task 2. The implementation was complete (roomHandlers.ts fully written) but uncommitted. Recovery: verified TypeScript clean + 263/263 server tests green, then committed and closed out manually.

## Next Phase Readiness

- Server-authoritative team selection fully implemented — client (16-04) can now wire `TeamSelectionScreen` against `team:selection-start`, `team:home-picked`, and `team:pick`
- `buildInitialGameState` and `broadcastState` work correctly end-to-end (confirmed by integration tests)

---

_Phase: 16-player-roster-team-selection_
_Completed: 2026-06-13_
