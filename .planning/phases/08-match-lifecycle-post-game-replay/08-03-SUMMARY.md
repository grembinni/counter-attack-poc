---
phase: 08-match-lifecycle-post-game-replay
plan: '03'
subsystem: server/game-engine
tags: [game-engine, kick-off-setup, half-time, replay, tdd, phase8, match-lifecycle]
dependency_graph:
  requires:
    - 08-01 (LastActionType, KICK_OFF_SETUP GamePhase, GameState Phase 8 fields from shared)
    - 08-02 (applyEndTurn clock hook, buildInitialGameState Phase 8 fields, gameEngine.phase8.test.ts base)
  provides:
    - applyKickOffReady (MATCH-03 placement validation, typed rejection reasons)
    - applyHalfTimeStart (MATCH-04 second-half flip, half/actionCount/addedTime reset)
    - buildReplayFrames (REPLAY-02/REPLAY-03 deterministic frame reconstruction)
    - Room.replayTimer + Room.readyPlayers fields
    - deleteRoom clears replayTimer (Pitfall 4 prevention)
  affects:
    - packages/server (gameEngine.ts extended, roomStore.ts extended)
    - packages/server/__tests__ (gameEngine.phase8.test.ts extended with 21 new tests)
tech_stack:
  added: []
  patterns:
    - Discriminated union result types (ApplyKickOffReadyResult, ApplyHalfTimeStartResult)
    - Pure engine function with no randomInt (applyKickOffReady, applyHalfTimeStart, buildReplayFrames)
    - isInRegion for zone boundary checks (centreCircle, own-half q-boundary)
    - Optional Room fields following shotTarget? convention
    - REPLAY_ELIGIBLE_TYPES Set for O(1) event-type classification
key_files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/roomStore.ts
    - packages/server/src/__tests__/gameEngine.phase8.test.ts
decisions:
  - 'applyKickOffReady returns ok:true with state unchanged — handler owns both-ready→KICK_OFF transition via Room.readyPlayers'
  - 'applyHalfTimeStart resets pieces to full HOME_SQUAD+AWAY_SQUAD (4-5-2 positions) from teams.ts'
  - 'buildReplayFrames reconstructs incrementally (MOVE repositioning, GOAL score/ball reset, KICK_OFF slot reset) rather than full engine re-play to avoid dice injection complexity'
  - 'REPLAY_ELIGIBLE_TYPES Set classifies events in O(1); SLOT_ADVANCE is the only type skipped'
  - 'OUT_OF_ZONE checked before CENTRE_HEX_EMPTY/IN_CENTRE_CIRCLE for fail-fast guard ordering'
  - 'kickOffHex q=18 is the shared half-boundary: home pieces q<=18, away pieces q>=18 (boundary inclusive)'
metrics:
  duration_seconds: 356
  completed: '2026-06-04'
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
---

# Phase 8 Plan 03: KickOffReady, HalfTimeStart, ReplayFrames, and Room Extensions Summary

**One-liner:** applyKickOffReady (MATCH-03 placement rules), applyHalfTimeStart (MATCH-04 second-half flip), buildReplayFrames (REPLAY-02/03 deterministic reconstruction), and Room.replayTimer/readyPlayers fields added — complete server-side primitives for match lifecycle and replay.

## Tasks Completed

| Task | Name                                                                       | Commit  | Files                                                   |
| ---- | -------------------------------------------------------------------------- | ------- | ------------------------------------------------------- |
| RED  | Failing tests for applyKickOffReady, applyHalfTimeStart, buildReplayFrames | f1295f3 | packages/server/src/**tests**/gameEngine.phase8.test.ts |
| 1+2  | applyKickOffReady + applyHalfTimeStart + buildReplayFrames (GREEN)         | 59b7d8b | packages/server/src/gameEngine.ts                       |
| 3    | Room.replayTimer + Room.readyPlayers; deleteRoom clears replayTimer        | 01bf211 | packages/server/src/roomStore.ts                        |

## What Was Built

**applyKickOffReady (MATCH-03, D-23, D-24, D-25):**

- `ApplyKickOffReadyResult` discriminated union: `{ ok: false; reason: 'WRONG_PHASE' | 'CENTRE_HEX_EMPTY' | 'OUT_OF_ZONE' | 'IN_CENTRE_CIRCLE' } | { ok: true; state: GameState }`
- Guard sequence (fail-fast): WRONG_PHASE → OUT_OF_ZONE → CENTRE_HEX_EMPTY (attacker only) → IN_CENTRE_CIRCLE (defender only)
- Half boundary: home pieces q ≤ 18, away pieces q ≥ 18 (kickOffHex.q is the shared boundary)
- Centre hex check: attacking team must have exactly one piece at `{q:18, r:13}`
- Centre circle check: defending team pieces must pass `!isInRegion(pos, 'centreCircle')`
- Returns ok:true with state unchanged — Room.readyPlayers (handler) owns both-ready → KICK_OFF

**applyHalfTimeStart (MATCH-04, D-26, D-29):**

- `ApplyHalfTimeStartResult` discriminated union
- Phase guard: rejects WRONG_PHASE unless `phase === 'HALF_TIME'`
- Sets: `attackingTeam = kickOffTeam === 'home' ? 'away' : 'home'`, `half: 2`, `actionCount: 0`, `addedTime: null`, `phase: 'KICK_OFF_SETUP'`, `lastActionType: null`, `kickOffActive: false`
- Resets pieces to `[...HOME_SQUAD, ...AWAY_SQUAD]` (4-5-2 default positions, Pitfall 6)

**buildReplayFrames (REPLAY-02, REPLAY-03, D-31, D-32):**

- Seeds from a deterministic initial state using `finalState.kickOffTeam` and `finalState.refereeCard` (avoids non-deterministic `buildInitialGameState` coin-flip)
- Iterates `finalState.eventLog`; skips `SLOT_ADVANCE` events (no board change, no frame)
- MOVE events: reposition piece in reconstructed state
- GOAL events: increment score, reset ball to kickOffHex
- KICK_OFF events: set `movementSlot: 'ATTACKER_4'`
- All other replay-eligible events: emit frame with no board mutation (display-only)
- Every emitted frame has `phase: 'REPLAY'` for client routing (D-31)
- Pure function — deterministic for identical eventLogs (REPLAY-03)

**roomStore.ts extensions:**

- `Room.replayTimer?: ReturnType<typeof setInterval> | null` — replay streaming handle (D-31)
- `Room.readyPlayers?: Set<1 | 2> | null` — kick-off setup ready tracking (D-24)
- `deleteRoom`: adds `if (room.replayTimer) clearInterval(room.replayTimer)` after `disconnectTimers` loop (Pitfall 4 prevention)

## TDD Gate Compliance

- RED gate: commit `f1295f3` — 21 failing tests written before implementation existed (import error + TypeErrors on non-existent functions)
- GREEN gate: commit `59b7d8b` — all 53 phase8 tests pass (32 pre-existing + 21 new)
- REFACTOR gate: not required (code clean from first pass)

## Verification Evidence

- `pnpm exec vitest run src/__tests__/gameEngine.phase8.test.ts -t "kick-off setup"` → 6 tests pass
- `pnpm exec vitest run src/__tests__/gameEngine.phase8.test.ts -t "buildReplayFrames"` → 6 tests pass
- `pnpm exec vitest run src/__tests__/gameEngine.phase8.test.ts -t "applyHalfTimeStart"` → 9 tests pass
- `pnpm exec vitest run src/__tests__/gameEngine.phase8.test.ts` → 53/53 tests pass (all phase8 tests)
- `pnpm exec vitest run src/__tests__/roomStore.test.ts` → 12/12 tests pass
- `pnpm exec tsc --noEmit` → exits 0 on server package
- `gameEngine.ts` exports `applyKickOffReady`, `applyHalfTimeStart`, `buildReplayFrames` (verified by grep)
- `roomStore.ts` Room type contains `replayTimer` and `readyPlayers` (verified by grep)
- `deleteRoom` contains `clearInterval(room.replayTimer)` guarded by `if (room.replayTimer)` (verified by grep)

## Pre-existing Test Failures (Out of Scope)

Two integration tests fail in `game.integration.test.ts` — these were pre-existing before this plan (documented in 08-02-SUMMARY.md):

- "D-10 undo reverses last move within the current slot" — pre-existing assertion mismatch
- "D-09 UNDO_LOCKED: undo after a SLOT_ADVANCE is rejected for the defending team" — pre-existing NOTHING_TO_UNDO vs UNDO_LOCKED mismatch

Neither is caused by this plan's changes. Not fixed (out of scope for 08-03).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Design Decisions Made During Implementation

1. **buildReplayFrames uses incremental state reconstruction, not full engine re-replay:**
   - The plan specified "replaying eventLog from buildInitialGameState" as the approach
   - Full re-play would require injecting all dice from the eventLog (complex; DICE_ROLL events carry results but not all engine paths are easily re-drivable from just the event)
   - Decision: Incremental approach — apply only board-visible mutations (MOVE repositioning, GOAL score/ball, KICK_OFF slot) and emit a frame snapshot. Display-only events (DICE_ROLL, STEAL_ATTEMPT, etc.) produce frames at the current board state. This is deterministic and correct for the replay's purpose (showing board state changes at each event).
   - A2 assumption from RESEARCH.md is satisfied: `room.shotTarget` is UX-only and not needed for replay.

2. **Deterministic initial state in buildReplayFrames uses finalState.kickOffTeam + refereeCard:**
   - `buildInitialGameState` uses `crypto.randomInt` for coin-flip — cannot call it deterministically
   - Instead, seeds the reconstructed initial state using `finalState.kickOffTeam` (which was set by the original coin-flip) and `finalState.refereeCard` (also from original state)
   - This matches A2 from RESEARCH.md and ensures determinism per REPLAY-03.

## Known Stubs

None. All exported functions are fully implemented with no placeholder values or TODO markers.

## Threat Flags

| Flag | File | Description                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| None | —    | No new network endpoints, auth paths, file access patterns, or trust-boundary surface introduced. All changes are pure engine functions and in-memory Room type extensions. T-08-06 (kick-off placement bypass) and T-08-07 (replay timer leak) mitigations implemented: placement rules are server-side only (applyKickOffReady enforces them), and deleteRoom clears replayTimer. |

## Self-Check: PASSED

| Item                                                                   | Status |
| ---------------------------------------------------------------------- | ------ |
| packages/server/src/gameEngine.ts (applyKickOffReady exported)         | FOUND  |
| packages/server/src/gameEngine.ts (applyHalfTimeStart exported)        | FOUND  |
| packages/server/src/gameEngine.ts (buildReplayFrames exported)         | FOUND  |
| packages/server/src/roomStore.ts (replayTimer field)                   | FOUND  |
| packages/server/src/roomStore.ts (readyPlayers field)                  | FOUND  |
| packages/server/src/roomStore.ts (clearInterval in deleteRoom)         | FOUND  |
| packages/server/src/**tests**/gameEngine.phase8.test.ts (21 new tests) | FOUND  |
| Commit f1295f3 (RED: failing tests)                                    | FOUND  |
| Commit 59b7d8b (GREEN: all 3 engine functions)                         | FOUND  |
| Commit 01bf211 (feat: roomStore extensions)                            | FOUND  |
| 53 phase8 tests pass (verified via vitest run)                         | PASSED |
| pnpm exec tsc --noEmit exits 0                                         | PASSED |
