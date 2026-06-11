---
phase: 11-rule-correctness
plan: 01
subsystem: api
tags: [socket.io, game-engine, header-duel, fsm, typescript, vitest]

# Dependency graph
requires:
  - phase: 10-remaining-action-flows
    provides: GAME_HEADER_CONTESTANT and GAME_HEADER_TARGET handlers; headerContestants/headerConfirmed fields; applyRoll HEADER branch; applyDeclareHeaderTarget
provides:
  - headerAccuracyRollPending flag on GameState (RULE-01 D-01): gates contestant selection until attacker acknowledges accuracy roll
  - headerDuelWinner field on GameState (RULE-02 D-04): records which team won the heading duel
  - GAME_HEADER_ACCURACY_ACK event: attacker-only acknowledgment clears headerAccuracyRollPending
  - computeHeaderDuelWinner engine helper: pure function computing duel winner from dice without transitioning phase
  - applyResolveHeaderTarget engine function: transitions HEADER -> PASS/GK_DIVING using pre-resolved winner, validates range against winner position (D-06)
  - GAME_HEADER_ACCURACY_ACK handler: attacker-only guard, clears pending flag
  - GAME_HEADER_CONTESTANT both-confirmed auto-duel: sets headerDuelWinner when both teams confirm
  - GAME_HEADER_TARGET winner guard: replaces attacker-only guard with duelWinner check (D-05)
affects: [11-02, 11-03, client-action-panel, client-hex-grid]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'headerCleared spread pattern extended: both new RULE-01/02 fields added so all HEADER terminal transitions null them atomically'
    - 'computeHeaderDuelWinner: pure duel-winner extraction without phase transition — separates duel resolution from state transition'
    - 'applyResolveHeaderTarget: winner-aware target resolution function following applyDeclareHeaderTarget signature'
    - 'GAME_HEADER_ACCURACY_ACK: zero-argument acknowledgment event pattern (same shape as GAME_HALF_TIME_START)'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.rule11.test.ts
    - packages/server/src/__tests__/gameHandlers.rule11.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameHandlers.phase10.test.ts

key-decisions:
  - 'D-03 confirmed: duel fires in GAME_HEADER_CONTESTANT when both teams confirm, not in GAME_HEADER_TARGET; phase stays HEADER after duel to allow target selection'
  - 'D-04 confirmed: headerDuelWinner field stores winner; null on tie — GAME_HEADER_TARGET returns WRONG_TEAM for null winner (tie path blocked at UI level)'
  - 'D-05 confirmed: GAME_HEADER_TARGET winner guard uses socketTeam(socket) !== headerDuelWinner, replacing controlsAttackingTeam'
  - 'D-06 confirmed: applyResolveHeaderTarget validates targetHex against winning contestant position (hexDistance > 6 -> INVALID_TARGET), not ball position'
  - 'Pitfall 4 prevention: GAME_HEADER_TARGET no longer calls applyRoll; uses applyResolveHeaderTarget to prevent double-duel'
  - "exactOptionalPropertyTypes enforced: headerDuelWinner?: 'home' | 'away' | null (not undefined)"
  - 'computeHeaderDuelWinner added to gameEngine.ts to keep handler thin and engine pure'

patterns-established:
  - 'Winner-aware target resolution: applyResolveHeaderTarget reads pre-resolved state field, no re-roll'
  - 'Duel-only computation: computeHeaderDuelWinner extracts winner without transitioning phase'

requirements-completed: [RULE-01, RULE-02]

# Metrics
duration: 45min
completed: 2026-06-11
---

# Phase 11 Plan 01: High-Pass Header Sequencing Fix (RULE-01/RULE-02) Summary

**Server-side header FSM corrected: accuracy roll now gates contestant selection (headerAccuracyRollPending flag), duel auto-fires when both teams confirm (headerDuelWinner field), and only the winning team can submit the target hex validated against their contestant's position**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-11T15:40:00Z
- **Completed:** 2026-06-11T15:55:00Z
- **Tasks:** 3
- **Files modified:** 6 (2 shared, 4 server)

## Accomplishments

- RULE-01: `headerAccuracyRollPending: true` set on HIGH_PASS->HEADER transition; new `GAME_HEADER_ACCURACY_ACK` handler (attacker-only) clears it; `headerCleared` spread nulls it on all terminal transitions
- RULE-02: `headerDuelWinner` field added; duel auto-fires in `GAME_HEADER_CONTESTANT` via `computeHeaderDuelWinner` when both teams confirm; `GAME_HEADER_TARGET` switches from attacker-only guard to winner-team guard; `applyResolveHeaderTarget` handles target resolution without re-rolling dice
- 24 new tests: 15 engine unit tests (WRONG_PHASE, DUEL_NOT_RESOLVED, valid resolve, INVALID_TARGET, GK_DIVING routing) + 9 handler integration tests (ack attacker/non-attacker/wrong-phase, auto-duel broadcast, winner/loser/null-tie guard)
- No regression: all 246 existing server tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RULE-01/RULE-02 GameState fields, event, and headerCleared wiring** - `1ab9743` (feat)
2. **Task 2: Add applyResolveHeaderTarget engine function and RULE-01/02 tests** - `899bcc9` (feat)
3. **Task 3: Wire handlers — accuracy ack, auto-duel on both-confirmed, winner guard on target** - `cefcecf` (feat)

## Files Created/Modified

- `packages/shared/src/types.ts` — Added `headerAccuracyRollPending?: boolean | null` (RULE-01 D-01) and `headerDuelWinner?: 'home' | 'away' | null` (RULE-02 D-04) fields to GameState
- `packages/shared/src/events.ts` — Added `GAME_HEADER_ACCURACY_ACK: 'game:header-accuracy-ack'` to ClientEvents and `[ClientEvents.GAME_HEADER_ACCURACY_ACK]: () => void` to ClientToServerEvents
- `packages/server/src/gameEngine.ts` — (1) `headerAccuracyRollPending: true` in HIGH_PASS->HEADER return; (2) both new fields in headerCleared object; (3) `computeHeaderDuelWinner` pure helper; (4) `applyResolveHeaderTarget` exported function
- `packages/server/src/gameHandlers.ts` — (1) New `GAME_HEADER_ACCURACY_ACK` handler; (2) GAME_HEADER_CONTESTANT both-confirmed auto-duel branch; (3) GAME_HEADER_TARGET winner guard + applyResolveHeaderTarget call
- `packages/server/src/__tests__/gameEngine.rule11.test.ts` — 15 unit tests for RULE-01 engine flag and RULE-02 applyResolveHeaderTarget
- `packages/server/src/__tests__/gameHandlers.rule11.test.ts` — 9 integration tests for all three handler changes
- `packages/server/src/__tests__/gameHandlers.phase10.test.ts` — Updated `seedHeaderPhaseConfirmed` to include `headerDuelWinner: 'home'` for RULE-02 compatibility

## Decisions Made

- `applyDeclareHeaderTarget` removed from GAME_HEADER_TARGET handler (was setting headerTargetHex before duel); replaced by `applyResolveHeaderTarget` which takes the target hex directly
- On duel tie (headerDuelWinner = null), GAME_HEADER_TARGET returns WRONG_TEAM for both teams — the UI/client will need to handle the tie display separately in Phase 12/13
- `computeHeaderDuelWinner` duplicates the pickWinner/buildResults logic from applyRoll HEADER branch rather than extracting a shared utility, to avoid changing the applyRoll call signature

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused applyDeclareHeaderTarget import in gameHandlers.ts**

- **Found during:** Task 3 (pre-commit hook lint check)
- **Issue:** `applyDeclareHeaderTarget` import was unused after replacing with `applyResolveHeaderTarget`
- **Fix:** Removed the import from the gameEngine.ts import list in gameHandlers.ts
- **Files modified:** packages/server/src/gameHandlers.ts
- **Verification:** ESLint passes, tsc --noEmit passes
- **Committed in:** cefcecf (Task 3 commit)

**2. [Rule 1 - Bug] Fixed exactOptionalPropertyTypes TS error in engine test**

- **Found during:** Task 2 (TypeScript check after writing test)
- **Issue:** `{ headerDuelWinner: undefined }` is not assignable to `Partial<GameState>` with strictOptionalProperties enabled
- **Fix:** Changed to destructure-and-spread pattern to omit the field entirely
- **Files modified:** packages/server/src/**tests**/gameEngine.rule11.test.ts
- **Verification:** tsc --noEmit exits 0
- **Committed in:** 899bcc9 (Task 2 commit)

**3. [Rule 1 - Bug] Updated seedHeaderPhaseConfirmed to set headerDuelWinner: 'home'**

- **Found during:** Task 3 (existing phase10 handler test regression)
- **Issue:** The existing `valid GAME_HEADER_TARGET fires the heading duel` test used `seedHeaderPhaseConfirmed` without `headerDuelWinner`. Under RULE-02, GAME_HEADER_TARGET now guards on `headerDuelWinner`; null winner returns WRONG_TEAM so the test failed
- **Fix:** Added `headerDuelWinner: 'home'` to seedHeaderPhaseConfirmed — home is the attacker so this matches the test's clientA (home) assertion
- **Files modified:** packages/server/src/**tests**/gameHandlers.phase10.test.ts
- **Verification:** All 12 phase10 handler tests pass
- **Committed in:** cefcecf (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs — lint/type/test-seed)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered

- Shared package must be built (`pnpm run build`) before `tsc --noEmit` in the server package picks up new fields from `packages/shared` — the server's TypeScript project reference reads compiled `.js`/`.d.ts` output, not source directly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- RULE-01/RULE-02 server-side fixes complete and tested
- Client-side changes needed in Phase 11 Plans 02/03: ActionPanel.tsx must gate contestant UI behind `headerAccuracyRollPending` and emit `GAME_HEADER_ACCURACY_ACK`; client also needs to display `headerDuelWinner` before target selection
- All 246 server tests pass; TypeScript compiles clean in both shared and server packages

---

_Phase: 11-rule-correctness_
_Completed: 2026-06-11_

## Self-Check: PASSED
