# Deferred Items — Phase 08.2 Passing Cleanup

## Pre-existing Integration Test Failures (Out of Scope)

Discovered during plan 08.2-03 execution. These failures existed BEFORE plan 03 changes
(verified by stashing changes and re-running tests).

### game.integration.test.ts — 3 failing tests

1. **D-10 undo reverses last move within the current slot**
   - Expected piece at `{q:11, r:7}` but got `{q:14, r:13}`
   - Root cause: Integration test hardcodes piece IDs `home-9`/`away-9` and positions
     that assume Phase 2-era squad positions, but the real HOME_SQUAD/AWAY_SQUAD uses
     Phase 6 board-photo positions. The test's `teamPrefix + '-9'` lookup finds a piece
     at a different position on the real 37x26 board.

2. **D-09 UNDO_LOCKED: undo after SLOT_ADVANCE rejected for defending team**
   - Expected `UNDO_LOCKED` but got `NOTHING_TO_UNDO`
   - Root cause: Same squad position mismatch; the test's move doesn't succeed, so
     no MOVE is in the event log, and undo returns `NOTHING_TO_UNDO` instead of `UNDO_LOCKED`.

3. **game:roll from active player in PASS phase → lastDiceRoll defined**
   - Expected `lastDiceRoll` to be defined but got `undefined`
   - Root cause: The roll handler requires phase === 'PASS' but the integration test
     may be reaching an incorrect phase due to the squad position issues cascading.

**Action needed:** Update `game.integration.test.ts` to use real squad piece IDs and
positions from HOME_SQUAD/AWAY_SQUAD, or mock the squad for integration tests.
These should be addressed in a dedicated cleanup plan.

Logged: 2026-06-06 (plan 08.2-03 execution)
